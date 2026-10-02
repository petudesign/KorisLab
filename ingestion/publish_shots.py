"""Publish per-match shot charts beside the existing season snapshot."""
import argparse
import json
from pathlib import Path
from datetime import datetime, timezone
from time import sleep, time

from ingestion.basketfi_statistics import BasketFiStatisticsClient
from normalization.basketfi_shots import normalize_shot_chart


def publish_shots(records, *, out_dir, client=None, max_age_seconds=86400, delay_seconds=1):
    client = client or BasketFiStatisticsClient()
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = {"published": 0, "cached": 0, "failures": []}
    for index, record in enumerate(records):
        match_id = str(record["game"]["source_id"])
        if not match_id.isdigit():
            raise ValueError("Match ID must be numeric")
        target = out_dir / f"{match_id}.json"
        previous = None
        if target.exists():
            try:
                previous = json.loads(target.read_text(encoding="utf-8"))
                if previous.get("match_id") != match_id or previous.get("schema_version") != "0.1":
                    previous = None
            except (ValueError, AttributeError):
                pass
        if previous and time() - target.stat().st_mtime < max_age_seconds:
            summary["cached"] += 1
            continue
        try:
            fixture_id = record["game"].get("upstream_fixture_id") or record.get("source", {}).get("upstream_fixture_id")
            if not fixture_id:
                match = client.torneo_client.get_match(match_id).get("match", {})
                fixture_id = match.get("match_external_id")
            if not fixture_id:
                raise ValueError("Match has no upstream fixture ID")
            fixture_id = str(fixture_id)
            payload = client.get_fixture(fixture_id, sub="shot_chart")
            snapshot = normalize_shot_chart(payload, match_id=match_id, fixture_id=fixture_id)
            # Compare field-goal totals with the verified box score, per team.
            checks = []
            for team in record["teams"]:
                rows = [shot for shot in snapshot["shots"] if shot["team_id"] == team["source_id"]]
                stats = team["stats"]
                for points, prefix in ((2, "two"), (3, "three")):
                    attempts = [shot for shot in rows if shot["points"] == points]
                    checks.append(len(attempts) == stats[f"{prefix}_pa"] and
                                  sum(shot["made"] for shot in attempts) == stats[f"{prefix}_pm"])
            snapshot["box_score_matches"] = all(checks)
            if previous and previous["shots"] and not snapshot["shots"]:
                raise ValueError("Source returned an empty chart; retaining previous data")
            if previous and all(previous.get(key) == value for key, value in snapshot.items() if key != "updated_at"):
                snapshot["updated_at"] = previous["updated_at"]
            temporary = target.with_suffix(".tmp")
            temporary.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
            temporary.replace(target)
            summary["published"] += 1
        except Exception as exc:
            summary["failures"].append({"match_id": match_id, "error": str(exc)})
        if delay_seconds and index < len(records) - 1:
            sleep(delay_seconds)
    return summary


def publish_player_shot_index(records, *, season_id, out_dir, out):
    """Publish a compact, player-indexed chart from the already checked match charts."""
    players = {}
    failures = []
    games_with_data = 0
    all_box_scores_match = bool(records)
    match_ids = [str(record["game"]["source_id"]) for record in records]
    if len(match_ids) != len(set(match_ids)):
        raise ValueError("Duplicate season match IDs")

    for record, match_id in zip(records, match_ids):
        try:
            chart = json.loads((out_dir / f"{match_id}.json").read_text(encoding="utf-8"))
            if chart.get("schema_version") != "0.1" or chart.get("match_id") != match_id or not isinstance(chart.get("shots"), list):
                raise ValueError("Invalid match shot chart")
        except (OSError, ValueError, AttributeError) as exc:
            all_box_scores_match = False
            failures.append({"match_id": match_id, "error": str(exc)})
            continue

        games_with_data += 1
        all_box_scores_match = all_box_scores_match and chart.get("box_score_matches") is True
        for shot in chart["shots"]:
            player_id = shot.get("player_id")
            if not isinstance(player_id, str) or not player_id:
                continue
            player = players.setdefault(player_id, {"id": player_id, "name": shot.get("player_name"), "shots": []})
            if not player["name"] and shot.get("player_name"):
                player["name"] = shot["player_name"]
            player["shots"].append({
                "x": shot.get("x"), "y": shot.get("y"),
                "points": shot.get("points"), "made": shot.get("made"),
            })

    snapshot = {
        "schema_version": "0.1",
        "season_id": season_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source_url": "https://tulospalvelu.basket.fi/",
        "expected_games": len(records),
        "games_with_data": games_with_data,
        "box_score_matches": all_box_scores_match and games_with_data == len(records),
        "players": sorted(players.values(), key=lambda row: row["id"]),
        "failures": failures,
    }
    previous = json.loads(out.read_text(encoding="utf-8")) if out.exists() else None
    if previous and all(previous.get(key) == value for key, value in snapshot.items() if key != "updated_at"):
        snapshot["updated_at"] = previous["updated_at"]
    out.parent.mkdir(parents=True, exist_ok=True)
    temporary = out.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(out)
    return {"out": str(out), "games_with_data": games_with_data, "expected_games": len(records),
            "players": len(players), "failures": failures}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season-file", type=Path, default=Path("data/normalized/season_verified.json"))
    parser.add_argument("--season-id", default="2025-26")
    parser.add_argument("--out-dir", type=Path, default=Path("web/public/shots"))
    parser.add_argument("--player-index-out", type=Path, default=Path("web/public/player-shots-2025-26.json"))
    parser.add_argument("--match-id", help="Publish just one match from the season file")
    args = parser.parse_args()
    all_records = json.loads(args.season_file.read_text(encoding="utf-8"))["matches"]
    records = all_records
    if args.match_id:
        records = [record for record in records if record["game"]["source_id"] == args.match_id]
        if not records:
            raise SystemExit("Match absent from selected season")
    summary = publish_shots(records, out_dir=args.out_dir)
    summary["player_index"] = publish_player_shot_index(all_records, season_id=args.season_id,
        out_dir=args.out_dir, out=args.player_index_out)
    print(json.dumps(summary, ensure_ascii=True))


if __name__ == "__main__":
    main()
