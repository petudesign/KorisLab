"""Rebuild simulation history and publish Sim Studio packs for upcoming men's and women's games.

python3 -m simulation.refresh                    # after ingestion.publish_season has cached the season's events
python3 -m simulation.refresh --league women --rebuild-history  # once, when earlier seasons' events are cached

Earlier seasons are stored as compact, gzipped possessions under data/history so the
scheduled job never refetches them. The current season is rebuilt from the event
cache on every run. No network requests are made.
"""
import argparse
from datetime import datetime
import gzip
import json
from pathlib import Path

from ingestion.publish_possessions import publish
from simulation.export import publish_packs
from simulation.history import join_season
from simulation.player_sim import PlayerModel
from simulation.track import HELSINKI, attach_results, read_archive, record_forecasts, write_archive

# Earlier seasons count less: rosters and roles change between seasons.
LEAGUES = {
    "men": {"slug": "korisliiga",
            "history": (("2024-25", Path("data/normalized/season_korisliiga_2024_2025.json"), 0.25),
                        ("2025-26", Path("data/normalized/season_korisliiga_2025_2026.json"), 0.5)),
            "current": ("2026-27", Path("web/public/korisliiga/season-2026-27.json"), 1.0)},
    "women": {"slug": "naisten-korisliiga",
              "history": (("2024-25", Path("data/normalized/season_2024_2025.json"), 0.25),
                          ("2025-26", Path("data/normalized/season_verified.json"), 0.5)),
              "current": ("2026-27", Path("web/public/season-2026-27.json"), 1.0)},
}
HISTORY_DIR = Path("data/history")
SITE_DATA = Path("prototypes/paper-home/public/data")
POSSESSION_FIELDS = ("period", "offense", "defense", "start", "end", "seconds", "events")


def matches(path):
    return json.loads(path.read_text(encoding="utf-8"))["matches"]


def possessions(records, cache, slug, season):
    """Score-reconciled possessions; lineups are not needed by the player model and are dropped."""
    result = publish(records, cache, season_id=f"{slug}-{season}", require_lineups=False)
    games = [{"match_id": g["match_id"], "possessions": [{k: p[k] for k in POSSESSION_FIELDS} for p in g["possessions"]]}
             for g in result["games"]]
    return games, result["excluded"]


def history_path(slug, season):
    return HISTORY_DIR / f"possessions-{slug}-{season}.json.gz"


def write_history(slug, season, games):
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    raw = json.dumps({"season_id": f"{slug}-{season}", "games": games}, ensure_ascii=False, separators=(",", ":"))
    # mtime=0 keeps the archive byte-identical when the content is unchanged.
    history_path(slug, season).write_bytes(gzip.compress(raw.encode("utf-8"), compresslevel=9, mtime=0))


def read_history(slug, season):
    return json.loads(gzip.decompress(history_path(slug, season).read_bytes()))["games"]


def site_dates(league, season):
    """Some older snapshots lack kickoff dates; the site's game files carry them."""
    path = SITE_DATA / f"{league}-{season}-matches.json"
    if not path.exists():
        return {}
    return {g["id"]: g["date"] for g in json.loads(path.read_text(encoding="utf-8")) if g.get("date")}


def refresh_league(league, args, now):
    today = now.date().isoformat()
    config, games, report = LEAGUES[league], [], {}
    for season, path, weight in config["history"]:
        records = matches(path)
        if args.rebuild_history:
            season_games, excluded = possessions(records, args.cache, config["slug"], season)
            write_history(config["slug"], season, season_games)
            report[season] = {"games": len(season_games), "excluded": len(excluded)}
        else:
            season_games = read_history(config["slug"], season)
            report[season] = {"games": len(season_games)}
        games += join_season(records, season_games, weight, site_dates(league, season))
    season, path, weight = config["current"]
    records = matches(path)
    season_games, excluded = possessions(records, args.cache, config["slug"], season)
    if records and not season_games:
        # Never publish packs that silently fall back to last season's rosters.
        raise SystemExit(f"No {league} {season} possessions from {len(records)} verified games: {excluded[:3]}")
    games += join_season(records, season_games, weight, site_dates(league, season))
    report[season] = {"games": len(season_games), "verified": len(records),
                      "excluded": [{"match_id": e["match_id"], "reason": e["reason"]} for e in excluded]}
    games.sort(key=lambda game: (game["date"], game["match_id"]))
    schedule = json.loads(path.read_text(encoding="utf-8"))["schedule"]
    index = publish_packs(PlayerModel(games), schedule, args.out_dir / league, today=today, games=args.games,
                          horizon_days=args.horizon_days, simulations=args.simulations)
    # Archive the forecasts before kick-off and score finished games against verified results.
    packs = [json.loads(path.read_text(encoding="utf-8")) for path in sorted((args.out_dir / league).glob("*.json"))
             if path.name != "index.json"]
    archive = record_forecasts(read_archive(league), packs, now)
    write_archive(league, attach_results(archive, records))
    report["packs"] = [{"match": g["id"], "date": g["date"], "home": g["home"]["name"], "away": g["away"]["name"],
                        "home_win": g["home_win_probability"]} for g in index]
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path, default=Path("data/cache/pbp"))
    parser.add_argument("--out-dir", type=Path, default=SITE_DATA / "sims")
    parser.add_argument("--league", choices=sorted(LEAGUES), action="append", help="Default: every league")
    parser.add_argument("--rebuild-history", action="store_true")
    parser.add_argument("--games", type=int, default=16, help="Most games per league")
    parser.add_argument("--horizon-days", type=int, default=14)
    parser.add_argument("--simulations", type=int, default=1000)
    parser.add_argument("--today", help="YYYY-MM-DD; defaults to today in Helsinki")
    args = parser.parse_args()
    now = datetime.fromisoformat(f"{args.today}T00:00:00").replace(tzinfo=HELSINKI) if args.today else datetime.now(HELSINKI)
    report = {league: refresh_league(league, args, now) for league in args.league or sorted(LEAGUES)}
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
