"""Publish possessions and lineup totals from cached events; exclude every unreconciled game."""
import argparse
import json
from pathlib import Path
from normalization.basketfi_possessions import lineup_totals, possessions_for_game


def publish(records, cache, *, season_id, require_lineups=True):
    games, excluded = [], []
    for record in records:
        match_id = record["game"]["source_id"]
        try:
            payload = json.loads((cache / f"{match_id}.json").read_text(encoding="utf-8"))
            diagnostics = {}
            possessions = possessions_for_game(payload, record, diagnostics=diagnostics, require_lineups=require_lineups)
        except (ValueError, KeyError, OSError) as error:
            excluded.append({"match_id": match_id, "reason": str(error)})
            continue
        games.append({"match_id": match_id, "date": record["game"].get("scheduled_at"), "diagnostics": diagnostics,
                      "possessions": possessions})
    return {"schema_version": "0.1", "season_id": season_id, "expected_games": len(records),
            "verified_games": len(games), "games_with_lineups": sum(g["diagnostics"]["lineups"] for g in games),
            "excluded": excluded,
            "methodology": {"lineups": "box_score_reconciled_onoff", "technical_free_throws": "outside_possessions",
                            "lineup_assignment": "lineups_at_possession_start", "lineup_seconds": "approximate"},
            "games": games, "lineups": lineup_totals(games)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--records", type=Path, default=Path("data/normalized/season_korisliiga_2025_2026.json"))
    parser.add_argument("--cache", type=Path, default=Path("data/cache/pbp"))
    parser.add_argument("--out", type=Path, default=Path("data/normalized/possessions_korisliiga_2025_2026.json"))
    parser.add_argument("--season-id", default="korisliiga-2025-26")
    parser.add_argument("--allow-missing-lineups", action="store_true",
                        help="Keep score-reconciled games whose lineups fail; their lineups are null")
    args = parser.parse_args()
    result = publish(json.loads(args.records.read_text(encoding="utf-8"))["matches"], args.cache, season_id=args.season_id,
                     require_lineups=not args.allow_missing_lineups)
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    possessions = sum(len(g["possessions"]) for g in result["games"])
    print(json.dumps({"verified": result["verified_games"], "with_lineups": result["games_with_lineups"],
                      "expected": result["expected_games"],
                      "possessions": possessions, "lineups": len(result["lineups"]),
                      "excluded": len(result["excluded"])}, ensure_ascii=False))
