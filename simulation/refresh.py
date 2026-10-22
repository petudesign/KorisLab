"""Rebuild simulation history and publish Sim Studio packs for upcoming Korisliiga games.

python3 -m simulation.refresh                    # after ingestion.publish_season has cached the season's events
python3 -m simulation.refresh --rebuild-history  # once, when earlier seasons' events are in data/cache/pbp

Earlier seasons are stored as compact, gzipped possessions under data/history so the
scheduled job never refetches them. The current season is rebuilt from the event
cache on every run. No network requests are made.
"""
import argparse
from datetime import datetime
import gzip
import json
from pathlib import Path
from zoneinfo import ZoneInfo

from ingestion.publish_possessions import publish
from simulation.export import publish_packs
from simulation.history import join_season
from simulation.player_sim import PlayerModel

# Earlier seasons count less: rosters and roles change between seasons.
HISTORY = (("2024-25", Path("data/normalized/season_korisliiga_2024_2025.json"), 0.25),
           ("2025-26", Path("data/normalized/season_korisliiga_2025_2026.json"), 0.5))
CURRENT = ("2026-27", Path("web/public/korisliiga/season-2026-27.json"), 1.0)
HISTORY_DIR = Path("data/history")
POSSESSION_FIELDS = ("period", "offense", "defense", "start", "end", "seconds", "events")


def matches(path):
    return json.loads(path.read_text(encoding="utf-8"))["matches"]


def possessions(records, cache, season):
    """Score-reconciled possessions; lineups are not needed by the player model and are dropped."""
    result = publish(records, cache, season_id=f"korisliiga-{season}", require_lineups=False)
    games = [{"match_id": g["match_id"], "possessions": [{k: p[k] for k in POSSESSION_FIELDS} for p in g["possessions"]]}
             for g in result["games"]]
    return games, result["excluded"]


def history_path(season):
    return HISTORY_DIR / f"possessions-korisliiga-{season}.json.gz"


def write_history(season, games):
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    raw = json.dumps({"season_id": f"korisliiga-{season}", "games": games}, ensure_ascii=False, separators=(",", ":"))
    # mtime=0 keeps the archive byte-identical when the content is unchanged.
    history_path(season).write_bytes(gzip.compress(raw.encode("utf-8"), compresslevel=9, mtime=0))


def read_history(season):
    return json.loads(gzip.decompress(history_path(season).read_bytes()))["games"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path, default=Path("data/cache/pbp"))
    parser.add_argument("--out-dir", type=Path, default=Path("prototypes/paper-home/public/data/sims"))
    parser.add_argument("--rebuild-history", action="store_true")
    parser.add_argument("--games", type=int, default=6)
    parser.add_argument("--simulations", type=int, default=1000)
    parser.add_argument("--today", help="YYYY-MM-DD; defaults to today in Helsinki")
    args = parser.parse_args()
    games, report = [], {}
    for season, path, weight in HISTORY:
        records = matches(path)
        if args.rebuild_history:
            season_games, excluded = possessions(records, args.cache, season)
            write_history(season, season_games)
            report[season] = {"games": len(season_games), "excluded": len(excluded)}
        else:
            season_games = read_history(season)
            report[season] = {"games": len(season_games)}
        games += join_season(records, season_games, weight)
    season, path, weight = CURRENT
    records = matches(path)
    season_games, excluded = possessions(records, args.cache, season)
    if records and not season_games:
        # Never publish packs that silently fall back to last season's rosters.
        raise SystemExit(f"No {season} possessions from {len(records)} verified games: {excluded[:3]}")
    games += join_season(records, season_games, weight)
    report[season] = {"games": len(season_games), "verified": len(records),
                      "excluded": [{"match_id": e["match_id"], "reason": e["reason"]} for e in excluded]}
    games.sort(key=lambda game: (game["date"], game["match_id"]))
    today = args.today or datetime.now(ZoneInfo("Europe/Helsinki")).date().isoformat()
    schedule = json.loads(path.read_text(encoding="utf-8"))["schedule"]
    index = publish_packs(PlayerModel(games), schedule, args.out_dir, today=today, games=args.games, simulations=args.simulations)
    report["packs"] = [{"match": g["id"], "date": g["date"], "home": g["home"]["name"], "away": g["away"]["name"],
                        "home_win": g["home_win_probability"]} for g in index]
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
