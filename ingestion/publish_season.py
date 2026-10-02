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
    print(json.dumps({"out": str(args.out), "scheduled": len(schedule), "played": snapshot["schedule_summary"]["played_games"], "verified": len(snapshot["matches"]), "failures": len(snapshot["failures"]), "shots": shots, "player_shots": player_shots, "quarters": quarters, "assists": assists}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
