"""Publish league-scoped charts from an already validated season dataset."""
import argparse
import json
from pathlib import Path
from ingestion.publish_shots import publish_shots, publish_player_shot_index
from ingestion.publish_quarters import publish_quarters
from ingestion.publish_assists import publish_assists
from ingestion.publish_replays import publish_replays
from ingestion.publish_onoff import publish as publish_onoff


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season-file", type=Path, required=True)
    parser.add_argument("--season-id", required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--cache-dir", type=Path, default=Path("data/cache/pbp"))
    parser.add_argument("--delay-seconds", type=float, default=1)
    args = parser.parse_args()
    records = json.loads(args.season_file.read_text(encoding="utf-8"))["matches"]
    args.out_dir.mkdir(parents=True, exist_ok=True)
    print(json.dumps({"stage": "shots", **publish_shots(records, out_dir=args.out_dir / "shots", delay_seconds=args.delay_seconds, max_age_seconds=10 * 365 * 86400)}), flush=True)
    print(json.dumps({"stage": "player-shots", **publish_player_shot_index(records, season_id=args.season_id, out_dir=args.out_dir / "shots", out=args.out_dir / f"player-shots-{args.season_id}.json")}), flush=True)
    print(json.dumps({"stage": "quarters", **publish_quarters(records, season_id=args.season_id, out=args.out_dir / f"quarters-{args.season_id}.json", cache_dir=args.cache_dir, delay_seconds=args.delay_seconds, max_age_seconds=10 * 365 * 86400)}), flush=True)
    print(json.dumps({"stage": "assists", **publish_assists(records, season_id=args.season_id, out=args.out_dir / f"assists-{args.season_id}.json", cache_dir=args.cache_dir)}), flush=True)
    print(json.dumps({"stage": "replays", **publish_replays(records, season_id=args.season_id.removesuffix("-playoffs"), out_dir=args.out_dir / "replays", cache_dir=args.cache_dir)}), flush=True)
    onoff = publish_onoff(records, args.cache_dir, season_id=args.season_id)
    (args.out_dir / f"onoff-{args.season_id}.json").write_text(json.dumps(onoff, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"stage": "onoff", "verified": onoff["verified_games"], "expected": onoff["expected_games"]}), flush=True)


if __name__ == "__main__":
    main()
