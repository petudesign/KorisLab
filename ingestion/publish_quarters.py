"""Publish a small season quarter summary; keep raw events in the ingestion cache."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from time import sleep, time

from ingestion.basketfi_statistics import BasketFiStatisticsClient
from normalization.basketfi_pbp import METRICS, fixture_data, normalize_quarter_stats


def publish_quarters(records, *, season_id, out, cache_dir, client=None, delay_seconds=1, max_age_seconds=86400):
    client = client or BasketFiStatisticsClient()
    cache_dir.mkdir(parents=True, exist_ok=True)
    teams = {}
    failures = []
    verified_games = 0
    match_ids = [str(record["game"]["source_id"]) for record in records]
    if len(match_ids) != len(set(match_ids)):
        raise ValueError("Duplicate season match IDs")
    for index, record in enumerate(records):
        if delay_seconds and index:
            sleep(delay_seconds)
        match_id = str(record["game"]["source_id"])
        if not match_id.isdigit():
            raise ValueError("Match ID must be numeric")
        for team in record["teams"]:
            teams.setdefault(team["source_id"], {"id": team["source_id"], "name": team["name"],
                "periods": {str(q): {metric: {"games": 0, "total": 0} for metric in METRICS} for q in range(1, 5)}})
        target = cache_dir / f"{match_id}.json"
        previous = None
        if target.exists():
            try:
                previous = json.loads(target.read_text(encoding="utf-8"))
            except ValueError:
                pass
        try:
            cached = previous and max_age_seconds > 0 and time() - target.stat().st_mtime < max_age_seconds
            if cached:
                payload = previous
                fixture = fixture_data(payload)
                fixture_id = fixture.get("id") or fixture.get("fixtureId")
            else:
                fixture_id = record["game"].get("upstream_fixture_id") or record.get("source", {}).get("upstream_fixture_id")
                shot_file = out.parent / "shots" / f"{match_id}.json"
                if not fixture_id and shot_file.exists():
                    shot = json.loads(shot_file.read_text(encoding="utf-8"))
                    if shot.get("match_id") == match_id:
                        fixture_id = shot.get("fixture_id")
                if not fixture_id:
                    fixture_id = client.torneo_client.get_match(match_id).get("match", {}).get("match_external_id")
                if not fixture_id:
                    raise ValueError("Match has no upstream fixture ID")
                payload = client.get_fixture(str(fixture_id), sub="pbp")
            normalized = normalize_quarter_stats(payload, record, fixture_id=fixture_id)
            if not cached:
                temporary = target.with_suffix(".tmp")
                temporary.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
                temporary.replace(target)
        except Exception as exc:
            failures.append({"match_id": match_id, "error": str(exc)})
            if not previous:
                continue
            try:
                fixture = fixture_data(previous)
                fixture_id = fixture.get("id") or fixture.get("fixtureId")
                normalized = normalize_quarter_stats(previous, record, fixture_id=fixture_id)
            except (ValueError, KeyError, TypeError, AttributeError):
                continue
        verified_games += 1
        for metric in normalized["verified_metrics"]:
            for q in range(1, 5):
                for team in record["teams"]:
                    row = teams[team["source_id"]]["periods"][str(q)][metric]
                    row["games"] += 1
                    row["total"] += normalized["periods"][str(q)][team["source_id"]][metric]
        skipped = set(METRICS) - set(normalized["verified_metrics"])
        if skipped:
            failures.append({"match_id": match_id, "error": "Box score mismatch: " + ", ".join(sorted(skipped))})
    snapshot = {"schema_version": "0.1", "season_id": season_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source_url": "https://tulospalvelu.basket.fi/", "expected_games": len(records),
        "verified_games": verified_games, "teams": list(teams.values()), "failures": failures}
    previous_summary = json.loads(out.read_text(encoding="utf-8")) if out.exists() else None
    # Do not replace a more complete same-season summary after a source outage.
    if previous_summary and previous_summary.get("season_id") == season_id:
        old_coverage = sum(row["games"] for team in previous_summary["teams"] for period in team["periods"].values() for row in period.values())
        coverage = sum(row["games"] for team in snapshot["teams"] for period in team["periods"].values() for row in period.values())
        if coverage < old_coverage:
            return {"retained_previous": True, "failures": failures}
        if all(previous_summary.get(key) == value for key, value in snapshot.items() if key != "updated_at"):
            snapshot["updated_at"] = previous_summary["updated_at"]
    out.parent.mkdir(parents=True, exist_ok=True)
    temporary = out.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(out)
    return {"out": str(out), "verified_games": verified_games, "failures": failures}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season-file", type=Path, default=Path("data/normalized/season_verified.json"))
    parser.add_argument("--season-id", default="2025-26")
    parser.add_argument("--out", type=Path, default=Path("web/public/quarters-2025-26.json"))
    parser.add_argument("--cache-dir", type=Path, default=Path("data/cache/pbp"))
    args = parser.parse_args()
    records = json.loads(args.season_file.read_text(encoding="utf-8"))["matches"]
    print(json.dumps(publish_quarters(records, season_id=args.season_id, out=args.out, cache_dir=args.cache_dir), ensure_ascii=True))


if __name__ == "__main__":
    main()
