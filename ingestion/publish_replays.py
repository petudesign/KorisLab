"""Publish verified replays from existing PBP caches; never invent missing events."""
import argparse
import json
from pathlib import Path
from normalization.basketfi_replay import normalize_replay


def publish_replays(records, *, season_id, cache_dir, out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    published, failures = [], []
    for record in records:
        match_id = str(record["game"]["source_id"])
        if not match_id.isdigit():
            raise ValueError("Match ID must be numeric")
        cached = cache_dir / f"{match_id}.json"
        if not cached.exists():
            continue
        try:
            result = normalize_replay(json.loads(cached.read_text(encoding="utf-8")), record, season_id=season_id)
        except (ValueError, KeyError, TypeError) as error:
            failures.append({"match_id": match_id, "error": str(error)})
            continue
        target = out_dir / f"{match_id}.json"
        temporary = target.with_suffix(".tmp")
        temporary.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        temporary.replace(target)
        published.append(match_id)
    return {"published": len(published), "failures": failures}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season-file", type=Path, default=Path("data/normalized/season_verified.json"))
    parser.add_argument("--season-id", default="2025-26")
    parser.add_argument("--out-dir", type=Path, default=Path("web/public/replays"))
    parser.add_argument("--cache-dir", type=Path, default=Path("data/cache/pbp"))
    args = parser.parse_args()
    records = json.loads(args.season_file.read_text(encoding="utf-8"))["matches"]
    print(json.dumps(publish_replays(records, season_id=args.season_id, cache_dir=args.cache_dir, out_dir=args.out_dir)))


if __name__ == "__main__":
    main()
