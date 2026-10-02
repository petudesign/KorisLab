"""Import a historical season, keeping regular/continuation and playoff games separate."""
import argparse
import json
from pathlib import Path
from analytics.export_web import export_summary
from analytics.season import aggregate_season
from ingestion.basketfi import BasketFiClient
from ingestion.basketfi_statistics import BasketFiStatisticsClient
from ingestion.season import extract_season_matches
from ingestion.season_statistics import hydrate_season_statistics


def publish_phase(schedule, *, competition_id, category_id, group_ids, out, cache, delay=1):
    rows = [row for row in schedule if row["group_id"] in group_ids]
    hydration = hydrate_season_statistics(rows, BasketFiStatisticsClient().get_match_statistics,
        cache_dir=cache, delay_seconds=delay)
    indexed = {row["source_match_id"]: row for row in rows}
    for record in hydration["snapshots"]:
        row = indexed[record["game"]["source_id"]]
        date, time = row.get("scheduled_date"), row.get("scheduled_time")
        record["game"]["scheduled_at"] = f"{date}T{time}" if date and time else date or None
        record["game"]["competition_phase"] = row["group_name"]
    result = {"schema_version": "0.1", "source": {"system": "basketfi_sportradar_embed", "entity": "season_statistics",
        "competition_id": competition_id, "category_id": category_id, "group_ids": sorted(group_ids)},
        "season": competition_id, "matches": hydration["snapshots"], "failures": hydration["failures"],
        "summary": {**hydration["summary"], "valid_games": len(hydration["snapshots"]), "invalid_games": 0},
        "aggregate": aggregate_season(hydration["snapshots"], season_id=competition_id)}
    out.parent.mkdir(parents=True, exist_ok=True)
    temporary = out.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(out)
    export_summary(out)
    return {"out": str(out), "games": len(result["matches"]), "expected": len(rows), "failures": result["failures"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--competition-id", default="2024-2025")
    parser.add_argument("--category-id", default="1")
    parser.add_argument("--regular-groups", nargs="+", default=["301604", "302075", "302076"])
    parser.add_argument("--playoff-groups", nargs="+", default=["302097"])
    parser.add_argument("--regular-out", type=Path, default=Path("data/normalized/season_2024_2025.json"))
    parser.add_argument("--playoff-out", type=Path, default=Path("data/normalized/season_playoffs_2024_2025.json"))
    parser.add_argument("--delay-seconds", type=float, default=1)
    args = parser.parse_args()
    payload = BasketFiClient().get_matches(args.competition_id, args.category_id)
    schedule = extract_season_matches(payload, played_only=True)
    available = {row["group_id"] for row in schedule}
    if not set(args.regular_groups + args.playoff_groups).issubset(available) or set(args.regular_groups) & set(args.playoff_groups):
        raise SystemExit("Unknown or overlapping season phases")
    for groups, out in ((args.regular_groups, args.regular_out), (args.playoff_groups, args.playoff_out)):
        print(json.dumps(publish_phase(schedule, competition_id=args.competition_id, category_id=args.category_id,
            group_ids=set(groups), out=out, cache=Path("data/cache/statistics"), delay=args.delay_seconds)), flush=True)


if __name__ == "__main__":
    main()
