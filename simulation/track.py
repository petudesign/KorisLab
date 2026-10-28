"""Keep every published pre-game forecast and score it against the result.

The archive stores, per game, the last simulation pack published before tip-off.
Once a game has a verified box score its result is attached; the forecast itself
is never changed after kick-off.

python3 -m simulation.track --backfill   # rebuild the archive from packs in git history
"""
import argparse
from datetime import datetime
import json
from pathlib import Path
import subprocess
from statistics import mean
from zoneinfo import ZoneInfo

HELSINKI = ZoneInfo("Europe/Helsinki")
ARCHIVE_DIR = Path("prototypes/paper-home/public/data/sims/archive")
PACK_DIRS = ("prototypes/paper-home/public/data/sims",)  # League folders and the first unsplit packs.


def kickoff(match):
    time = (match.get("time") or "23:59:00")[:8]
    return datetime.fromisoformat(f"{match['date']}T{time}").replace(tzinfo=HELSINKI)


def forecast_entry(pack, published_at):
    m, s = pack["match"], pack["summary"]
    return {"match": m, "model": pack["model"], "data_cutoff": pack["data_cutoff"], "published_at": published_at,
            "home_win_probability": s["home_win_probability"], "mean_score": s["mean_score"],
            "margin": s["margin"], "overtime_probability": s["overtime_probability"],
            "players": [{"id": p["id"], "name": p["name"], "team": p["team"], "mean": p["points"]["mean"],
                         "p10": p["points"]["p10"], "p90": p["points"]["p90"]} for p in pack["players"]]}


def record_forecasts(archive, packs, now):
    """Keep the newest forecast for games that have not started; started games stay frozen.

    An unchanged forecast keeps its original publication time, so repeated runs write no diff."""
    content = lambda entry: {k: v for k, v in entry.items() if k not in ("published_at", "result")}
    for pack in packs:
        match_id = pack["match"]["id"]
        if now >= kickoff(pack["match"]):
            continue
        entry, previous = forecast_entry(pack, now.isoformat(timespec="seconds")), archive.get(match_id)
        if previous is None or content(previous) != content(entry):
            archive[match_id] = entry
    return archive


def attach_results(archive, records):
    by_id = {str(r["game"]["source_id"]): r for r in records}
    for match_id, entry in archive.items():
        record = by_id.get(match_id)
        if record is None:
            continue
        teams = {t["source_id"]: t for t in record["teams"]}
        home, away = teams.get(entry["match"]["home"]["id"]), teams.get(entry["match"]["away"]["id"])
        if home is None or away is None:
            continue
        points = {p["source_player_id"]: (p.get("stats") or {}).get("points") for t in record["teams"] for p in t["players"]
                  if p.get("participated") is not False}
        entry["result"] = {"home_score": home["score"], "away_score": away["score"],
                           "player_points": {pid: pts for pid, pts in points.items() if pts is not None}}
    return archive


def summarize(archive):
    """Plain scores a reader can check: Brier, favourite hit rate, margin error, interval coverage."""
    games = [e for e in archive.values() if "result" in e]
    if not games:
        return {"games": 0}
    rows = []
    for e in games:
        home_won = e["result"]["home_score"] > e["result"]["away_score"]
        rows.append((e["home_win_probability"], home_won, e["mean_score"], e["result"], e))
    brier = mean((p - won) ** 2 for p, won, *_ in rows)
    called = [(p, won) for p, won, *_ in rows if p != 0.5]
    margins = [abs((ms[e["match"]["home"]["id"]] - ms[e["match"]["away"]["id"]]) - (r["home_score"] - r["away_score"]))
               for _, _, ms, r, e in rows]
    inside = total = 0
    for *_, result, e in rows:
        for player in e["players"]:
            actual = result["player_points"].get(player["id"])
            if actual is not None:
                total += 1
                inside += player["p10"] <= actual <= player["p90"]
    buckets = []
    for low in (0.0, 0.2, 0.4, 0.6, 0.8):
        group = [(p, won) for p, won, *_ in rows if low <= max(p, 1 - p) < low + 0.2 or (low == 0.8 and max(p, 1 - p) == 1)]
        if group:
            buckets.append({"range": f"{low:.1f}-{low + 0.2:.1f}", "games": len(group),
                            "mean_favourite_probability": round(mean(max(p, 1 - p) for p, _ in group), 3),
                            "favourite_win_rate": round(mean((p > 0.5) == won for p, won in group), 3)})
    return {"games": len(rows), "brier": round(brier, 4), "coin_flip_brier": 0.25,
            "favourites_won": sum((p > 0.5) == won for p, won in called), "favourites": len(called),
            "margin_mae": round(mean(margins), 1), "player_interval_coverage": round(inside / total, 3) if total else None,
            "player_interval_target": 0.8, "players_checked": total, "calibration": buckets}


def read_archive(league):
    path = ARCHIVE_DIR / f"{league}.json"
    return json.loads(path.read_text(encoding="utf-8"))["games"] if path.exists() else {}


def write_archive(league, archive):
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"league": league, "summary": summarize(archive),
               "games": dict(sorted(archive.items(), key=lambda item: (item[1]["match"]["date"], item[0])))}
    (ARCHIVE_DIR / f"{league}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def backfill_from_git(league):
    """Last version of each pack committed before tip-off, from every path packs have lived at."""
    paths = [f"{base}/{league}" for base in PACK_DIRS] + ([f"{PACK_DIRS[0]}/*.json"] if league == "men" else [])
    log = subprocess.run(["git", "log", "--reverse", "--format=%H %cI", "--name-only", "--", *paths],
                         capture_output=True, text=True, check=True).stdout
    archive, commit, when = {}, None, None
    for line in log.splitlines():
        if not line.strip():
            continue
        parts = line.split(" ")
        if len(parts) == 2 and len(parts[0]) == 40:
            commit, when = parts[0], datetime.fromisoformat(parts[1].replace("Z", "+00:00"))
            continue
        name = Path(line).name
        if not name[:-5].isdigit():
            continue
        shown = subprocess.run(["git", "show", f"{commit}:{line}"], capture_output=True, text=True)
        if shown.returncode:
            continue  # The commit deleted this pack.
        pack = json.loads(shown.stdout)
        if when < kickoff(pack["match"]):
            archive[pack["match"]["id"]] = forecast_entry(pack, when.isoformat(timespec="seconds"))
    return archive


if __name__ == "__main__":
    from simulation.refresh import LEAGUES, matches
    parser = argparse.ArgumentParser()
    parser.add_argument("--backfill", action="store_true")
    args = parser.parse_args()
    for league, config in LEAGUES.items():
        archive = backfill_from_git(league) if args.backfill else read_archive(league)
        attach_results(archive, matches(config["current"][1]))
        write_archive(league, archive)
        print(json.dumps({league: summarize(archive)}, ensure_ascii=False))
