"""Publish assist outcomes from the already downloaded, checked play-by-play cache."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

from normalization.basketfi_assists import normalize_assists
from normalization.basketfi_pbp import fixture_data


def publish_assists(records, *, season_id, out, cache_dir):
    players = {}
    failures = []
    verified = []
    match_ids = [str(record["game"]["source_id"]) for record in records]
    if len(set(match_ids)) != len(match_ids):
        raise ValueError("Duplicate season match IDs")
    for record, match_id in zip(records, match_ids):
        if not match_id.isdigit():
            raise ValueError("Match ID must be numeric")
        try:
            payload = json.loads((cache_dir / f"{match_id}.json").read_text(encoding="utf-8"))
            fixture = fixture_data(payload)
            fixture_id = fixture.get("id") or fixture.get("fixtureId")
            rows = normalize_assists(payload, record, fixture_id=fixture_id)
        except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
            failures.append({"match_id": match_id, "error": str(exc)})
            continue
        verified.append(match_id)
        for row in rows:
            total = players.setdefault(row["id"], {**row, **dict.fromkeys(
                ("games", "assists", "two", "three", "free_throw", "unlinked"), 0)})
            for key in ("games", "assists", "two", "three", "free_throw", "unlinked"):
                total[key] += row[key]
    snapshot = {"schema_version": "0.1", "season_id": season_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source_url": "https://tulospalvelu.basket.fi/", "expected_games": len(records),
        "verified_games": len(verified), "match_ids": verified,
        "players": sorted(players.values(), key=lambda row: row["id"]), "failures": failures}
    previous = json.loads(out.read_text(encoding="utf-8")) if out.exists() else None
    if previous and all(previous.get(key) == value for key, value in snapshot.items() if key != "updated_at"):
        snapshot["updated_at"] = previous["updated_at"]
    out.parent.mkdir(parents=True, exist_ok=True)
    temporary = out.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(out)
    return {"verified_games": len(verified), "expected_games": len(records), "failures": failures}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season-file", type=Path, default=Path("data/normalized/season_verified.json"))
    parser.add_argument("--season-id", default="2025-26")
    parser.add_argument("--out", type=Path, default=Path("web/public/assists-2025-26.json"))
    parser.add_argument("--cache-dir", type=Path, default=Path("data/cache/pbp"))
    args = parser.parse_args()
    records = json.loads(args.season_file.read_text(encoding="utf-8"))["matches"]
    print(json.dumps(publish_assists(records, season_id=args.season_id, out=args.out, cache_dir=args.cache_dir)))
