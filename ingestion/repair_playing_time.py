"""Replay a cached official PBP audit into legacy season files (no network).

Usage: python -m ingestion.repair_playing_time --pbp-dir /path/to/payloads
Unreconciled minutes become unavailable; counting stats and original values stay.
"""
import argparse
import hashlib
import json
from pathlib import Path

from normalization.playing_time import legacy_minute_teams, recover_legacy_minutes, quarantine_legacy_minutes
from validation.checks import validate_statistics_snapshot


def repair(path, pbp_dir, cache_dir):
    raw = path.read_bytes()
    season = json.loads(raw)
    results = []
    for record in season.get("matches", []):
        if not legacy_minute_teams(record):
            continue
        match_id = str(record["game"]["source_id"])
        players = sum(len(t["players"]) for t in record["teams"])
        try:
            payload = json.loads((pbp_dir / f"{match_id}.json").read_text())
            recover_legacy_minutes(record, payload)
            status, reason = "recovered", None
        except (ValueError, FileNotFoundError) as exc:
            reason = str(exc)
            quarantine_legacy_minutes(record, reason)
            status = "withheld"
        record["validation"] = validate_statistics_snapshot(record)
        if not record["validation"]["valid"]:
            raise ValueError(f"Repair invalidated box score: {match_id}")
        results.append({"match_id": match_id, "status": status, "players": players, "reason": reason})
        # Replace the matching stale cache without touching unrelated fixtures.
        cache = cache_dir / (hashlib.sha256(match_id.encode()).hexdigest() + ".json")
        if cache.exists():
            cache.write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")
    if results:
        path.write_text(json.dumps(season, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"file": str(path), "original_sha256": hashlib.sha256(raw).hexdigest(), "matches": results}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pbp-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("docs/playing-time-audit-2026-10-21.json"))
    args = parser.parse_args()
    audit = [repair(p, args.pbp_dir, Path("data/cache/statistics")) for p in sorted(Path("data/normalized").glob("season*.json"))]
    audit = [row for row in audit if row["matches"]]
    if audit:
        previous = json.loads(args.output.read_text()) if args.output.exists() else []
        args.output.write_text(json.dumps(previous + audit, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({status: sum(r["status"] == status for s in audit for r in s["matches"]) for status in ("recovered", "withheld")}))
