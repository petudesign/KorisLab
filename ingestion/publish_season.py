"""Refresh the public current-season snapshot using the existing validated adapter."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

from analytics.season import aggregate_season
from ingestion.basketfi import BasketFiClient
from ingestion.basketfi_statistics import BasketFiStatisticsClient
from ingestion.season import extract_season_matches, summarize_season_schedule
from ingestion.season_statistics import hydrate_season_statistics
from ingestion.publish_shots import publish_shots, publish_player_shot_index
from ingestion.publish_quarters import publish_quarters
from ingestion.publish_assists import publish_assists
from ingestion.publish_replays import publish_replays
from validation.checks import validate_statistics_snapshot


def build_snapshot(schedule, hydration, *, previous=None, competition_id="huki2627"):
    """Keep a last good box score if a later fetch fails; report missing coverage."""
    played_ids = {row["source_match_id"] for row in schedule if row["status"].lower() in {"played", "finished", "completed"}}
    records = {}
    for record in (previous or {}).get("matches", []):
        if record.get("game", {}).get("source_id") in played_ids and validate_statistics_snapshot(record)["valid"]:
            records[record["game"]["source_id"]] = record
    for record in hydration["snapshots"]:
        records[record["game"]["source_id"]] = record
    rows_by_id = {row["source_match_id"]: row for row in schedule}
    for match_id, record in records.items():
        row = rows_by_id[match_id]
        # Preserve the source's Finnish local calendar date for the existing charts.
        record["game"]["scheduled_at"] = row["scheduled_date"]
    matches = list(records.values())
    snapshot = {
        "schema_version": "0.1",
        "season_id": competition_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source_url": "https://tulospalvelu.basket.fi/",
        "schedule": schedule,
        "schedule_summary": summarize_season_schedule(schedule),
        "matches": matches,
        "summary": {**hydration["summary"], "valid_games": len(matches), "invalid_games": 0},
        "aggregate": aggregate_season(matches, season_id=competition_id),
        "failures": hydration["failures"],
    }
    if previous and all(previous.get(key) == value for key, value in snapshot.items() if key != "updated_at"):
        snapshot["updated_at"] = previous["updated_at"]
    return snapshot


def verify_publication_coverage(schedule, snapshot, *, season_id, quarters_path, shots_dir, replays_dir, shot_summary):
    """Fail before publishing if played games have unverified core match assets."""
    played_ids = sorted({
        str(row["source_match_id"])
        for row in schedule
        if str(row.get("status", "")).lower() in {"played", "finished", "completed"}
    })
    records = {
        str(record.get("game", {}).get("source_id")): record
        for record in snapshot.get("matches", [])
        if isinstance(record, dict) and record.get("game", {}).get("source_id") is not None
    }
    errors = []
    for match_id in played_ids:
        record = records.get(match_id)
        if record is None:
            errors.append(f"{match_id}: missing verified box score")
            continue
        # The statistics endpoint may omit period rows even when the separate
        # play-by-play feed contains complete, verified period scores. Validate
        # the box score here; period coverage is checked against the replay below.
        validation = validate_statistics_snapshot(record)
        if not validation["valid"]:
            failed = [check["name"] for check in validation["checks"] if check["status"] == "fail"]
            errors.append(f"{match_id}: invalid completed-game statistics ({', '.join(failed)})")

    replay_period_totals = dict.fromkeys(range(1, 5), 0)
    available_replay_ids = []
    for match_id in played_ids:
        record = records.get(match_id)
        if record is None:
            continue
        replay_path = replays_dir / f"{match_id}.json"
        try:
            replay = json.loads(replay_path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            errors.append(f"{match_id}: verified replay is missing ({exc})")
            continue
        period_numbers = {row.get("number") for row in replay.get("periods", []) if isinstance(row, dict)}
        events = replay.get("events", [])
        final_event = events[-1] if isinstance(events, list) and events else {}
        home = next((team for team in record.get("teams", []) if team.get("home_away") == "home"), None)
        away = next((team for team in record.get("teams", []) if team.get("home_away") == "away"), None)
        replay_valid = (
            replay.get("schema_version") == "0.1"
            and str(replay.get("match_id")) == match_id
            and replay.get("verified") is True
            and replay.get("event_count", 0) > 0
            and {1, 2, 3, 4}.issubset(period_numbers)
            and home is not None and away is not None
            and final_event.get("home") == home.get("score")
            and final_event.get("away") == away.get("score")
        )
        period_ends = {}
        if replay_valid:
            for period in range(1, 5):
                endings = [event for event in events if isinstance(event, dict)
                           and event.get("kind") == "periodEnd" and event.get("period") == period]
                if len(endings) != 1:
                    replay_valid = False
                    break
                ending = endings[0]
                scores = (ending.get("home"), ending.get("away"))
                if any(isinstance(score, bool) or not isinstance(score, int) or score < 0 for score in scores):
                    replay_valid = False
                    break
                period_ends[period] = scores
        if replay_valid:
            previous = (0, 0)
            for period in range(1, 5):
                current = period_ends[period]
                if current[0] < previous[0] or current[1] < previous[1]:
                    replay_valid = False
                    break
                replay_period_totals[period] += current[0] - previous[0] + current[1] - previous[1]
                previous = current
        if not replay_valid:
            errors.append(f"{match_id}: replay does not reconcile with the completed game")
        else:
            available_replay_ids.append(match_id)

    try:
        quarter_snapshot = json.loads(quarters_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        quarter_snapshot = {}
        errors.append(f"quarter summary: cannot read output ({exc})")
    if quarter_snapshot.get("season_id") != season_id:
        errors.append("quarter summary: season ID differs from current run")
    if quarter_snapshot.get("expected_games") != len(played_ids) or quarter_snapshot.get("verified_games") != len(played_ids):
        errors.append(f"quarter summary: expected and verified coverage must both equal {len(played_ids)}")
    quarter_teams = quarter_snapshot.get("teams", [])
    for period in range(1, 5):
        points_rows = [
            team.get("periods", {}).get(str(period), {}).get("points", {})
            for team in quarter_teams
        ]
        games_covered = sum(row.get("games", 0) for row in points_rows)
        expected_points = replay_period_totals[period]
        if games_covered != 2 * len(played_ids) or sum(row.get("total", 0) for row in points_rows) != expected_points:
            errors.append(f"quarter summary: period {period} point coverage or totals do not match completed games")

    unavailable_ids = {
        str(row.get("match_id"))
        for row in shot_summary.get("unavailable", [])
        if row.get("match_id") is not None
    }
    available_shot_ids = []
    for match_id in played_ids:
        record = records.get(match_id)
        if record is None:
            continue
        shot_path = shots_dir / f"{match_id}.json"
        chart = None
        if shot_path.exists():
            try:
                chart = json.loads(shot_path.read_text(encoding="utf-8"))
            except (OSError, ValueError) as exc:
                errors.append(f"{match_id}: invalid shot-chart JSON ({exc})")
                continue
        valid_chart = (
            isinstance(chart, dict)
            and chart.get("schema_version") == "0.1"
            and str(chart.get("match_id")) == match_id
            and isinstance(chart.get("shots"), list)
            and any(
                isinstance(shot, dict)
                and isinstance(shot.get("x"), (int, float)) and not isinstance(shot.get("x"), bool)
                and isinstance(shot.get("y"), (int, float)) and not isinstance(shot.get("y"), bool)
                for shot in chart["shots"]
            )
        )
        if not valid_chart:
            if match_id in unavailable_ids:
                continue
            errors.append(f"{match_id}: shot chart is missing or has no verified coordinates")
            continue

        teams = record.get("teams", [])
        chart_matches_box_score = True
        for team in teams:
            rows = [shot for shot in chart["shots"] if shot.get("team_id") == team.get("source_id")]
            for points, prefix in ((2, "two"), (3, "three")):
                attempts = [shot for shot in rows if shot.get("points") == points]
                stats = team.get("stats", {})
                if (len(attempts) != stats.get(f"{prefix}_pa")
                        or sum(shot.get("made") is True for shot in attempts) != stats.get(f"{prefix}_pm")):
                    chart_matches_box_score = False
        if not chart_matches_box_score or chart.get("box_score_matches") is not True:
            errors.append(f"{match_id}: shot chart does not reconcile with the box score")
        else:
            available_shot_ids.append(match_id)

    if errors:
        raise ValueError("Publication coverage check failed:\n- " + "\n- ".join(errors))
    return {
        "played_games": len(played_ids),
        "statistics_verified": len(played_ids),
        "quarter_scores_verified": len(played_ids),
        "replays_verified": len(available_replay_ids),
        "shot_charts_available": len(available_shot_ids),
        "shot_charts_unavailable": len((unavailable_ids & set(played_ids)) - set(available_shot_ids)),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--competition-id", default="huki2627")
    parser.add_argument("--season-id", default="2026-27")
    parser.add_argument("--category-id", default="1")
    parser.add_argument("--group-id", default="303031")
    parser.add_argument("--out", type=Path, default=Path("web/public/season-2026-27.json"))
    parser.add_argument("--cache-dir", type=Path, default=Path("data/cache/statistics"))
    args = parser.parse_args()
    # If schedule retrieval fails, leave the published snapshot untouched.
    schedule = extract_season_matches(BasketFiClient().get_matches(args.competition_id, args.category_id), group_id=args.group_id)
    if not schedule:
        raise SystemExit("Source returned no schedule; keeping the previous snapshot")
    ids = [row["source_match_id"] for row in schedule]
    if len(ids) != len(set(ids)):
        raise SystemExit("Duplicate match IDs; keeping the previous snapshot")
    previous = json.loads(args.out.read_text(encoding="utf-8")) if args.out.exists() else None
    if previous and previous.get("season_id") != args.competition_id:
        raise SystemExit("Output belongs to a different season")
    hydration = hydrate_season_statistics(schedule, BasketFiStatisticsClient().get_match_statistics,
        delay_seconds=1, cache_dir=args.cache_dir, cache_max_age_seconds=24 * 60 * 60)
    snapshot = build_snapshot(schedule, hydration, previous=previous, competition_id=args.competition_id)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.out.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(args.out)
    shots_dir = args.out.parent / "shots"
    shots = publish_shots(snapshot["matches"], out_dir=shots_dir)
    player_shots = publish_player_shot_index(snapshot["matches"], season_id=args.season_id,
        out_dir=shots_dir, out=args.out.parent / f"player-shots-{args.season_id}.json")
    quarters = publish_quarters(snapshot["matches"], season_id=args.season_id,
        out=args.out.parent / f"quarters-{args.season_id}.json", cache_dir=args.cache_dir.parent / "pbp")
    assists = publish_assists(snapshot["matches"], season_id=args.season_id,
        out=args.out.parent / f"assists-{args.season_id}.json", cache_dir=args.cache_dir.parent / "pbp")
    replays = publish_replays(snapshot["matches"], season_id=args.season_id,
        out_dir=args.out.parent / "replays", cache_dir=args.cache_dir.parent / "pbp")
    try:
        coverage = verify_publication_coverage(
            schedule,
            snapshot,
            season_id=args.season_id,
            quarters_path=args.out.parent / f"quarters-{args.season_id}.json",
            shots_dir=shots_dir,
            replays_dir=args.out.parent / "replays",
            shot_summary=shots,
        )
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    print(json.dumps({"out": str(args.out), "scheduled": len(schedule), "played": snapshot["schedule_summary"]["played_games"], "verified": len(snapshot["matches"]), "failures": len(snapshot["failures"]), "coverage": coverage, "shots": shots, "player_shots": player_shots, "quarters": quarters, "assists": assists, "replays": replays}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
