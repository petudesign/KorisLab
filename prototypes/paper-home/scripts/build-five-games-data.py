#!/usr/bin/env python3
"""Frozen numbers for the article "Mitä viisi ottelua kertoo?". Run once per article update; not part of the build.

python3 scripts/build-five-games-data.py   (from prototypes/paper-home)
"""
from collections import defaultdict
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA, OUT = ROOT / "public/data", ROOT / "source/analysis-five-games.json"
COMPLETED, CURRENT = ("2024-25", "2025-26"), "2026-27"
SEASONS = json.loads((ROOT / "source/seasons.json").read_text(encoding="utf-8"))
EXAMPLES = {"women": ("Kouvottaret", "ToPo", "HBA-Märsky", "Espoo Basket Team", "Peli-Karhut", "Vimpelin Veto"), "men": ("KTP-Basket", "Kipinä Basket")}
METRICS = ("offensive_rating", "defensive_rating", "efg_pct", "offensive_rebound_pct", "turnover_pct")


def load(league, season):
    games = json.loads((DATA / f"{league}-{season}-matches.json").read_text(encoding="utf-8"))
    return sorted((g for g in games if g.get("verified")), key=lambda g: g["date"])


def corr(x, y):
    mx, my = sum(x) / len(x), sum(y) / len(y)
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / (sum((a - mx) ** 2 for a in x) * sum((b - my) ** 2 for b in y)) ** 0.5


def sides(game):
    a, b = game["teams"]
    return ((a, b), (b, a))


def team_seasons(league, season, first=5):
    """The first recorded games against the rest of the same regular season."""
    played, early, wins, rest = defaultdict(int), defaultdict(int), defaultdict(int), defaultdict(list)
    for game in load(league, season):
        for team, other in sides(game):
            margin = team["score"] - other["score"]
            if played[team["name"]] < first:
                early[team["name"]] += margin
                wins[team["name"]] += margin > 0
            else:
                rest[team["name"]].append(margin > 0)
            played[team["name"]] += 1
    return [{"team": name, "season": season, "wins": wins[name], "margin": round(early[name] / first, 1),
             "restGames": len(rest[name]), "restWinPct": round(100 * sum(rest[name]) / len(rest[name]), 1)}
            for name in early if len(rest[name]) >= 5]


def table(league, season):
    teams = defaultdict(lambda: {"wins": 0, "losses": 0, "diff": 0})
    for game in load(league, season):
        for team, other in sides(game):
            row, margin = teams[team["name"]], team["score"] - other["score"]
            row["wins" if margin > 0 else "losses"] += 1
            row["diff"] += margin
    return teams


def season_length(league):
    """Is the gap about five games being a bigger share of a shorter season? Compare other lengths too."""
    games = defaultdict(int)
    for season in COMPLETED:
        for game in load(league, season):
            for team in game["teams"]:
                games[(season, team["name"])] += 1
    corr_at = {}
    for first in (3, 5, 7, 8, 10):
        rows = [row for season in COMPLETED for row in team_seasons(league, season, first)]
        corr_at[str(first)] = round(corr([r["margin"] for r in rows], [r["restWinPct"] for r in rows]), 2)
    teams = {season: len({t for s, t in games if s == season}) for season in COMPLETED}
    return {"teams": teams, "gamesPerTeam": [min(games.values()), max(games.values())], "corrAt": corr_at}


def display_name(name):
    """Some source rows are in capitals; show them like every other name."""
    return name.title() if name.isupper() else name


def minutes_by_player(league, season):
    players = defaultdict(dict)
    for game in load(league, season):
        for team in game["teams"]:
            for player in team["players"]:
                minutes = player.get("minutesValue") or 0
                if minutes > 0:
                    row = players[team["name"]].setdefault(player["id"], {"name": display_name(player["name"]), "minutes": 0, "games": 0, "points": 0})
                    row["minutes"] += minutes
                    row["games"] += 1
                    row["points"] += (player.get("stats") or {}).get("points") or 0
    return players


def team_change(league, name):
    """Season so far against last season: site metrics, and who has played here before."""
    metrics = lambda season: next((t["metrics"] for t in SEASONS[league][season]["aggregate"]["teams"] if t["name"] == name), None)
    now, before = minutes_by_player(league, CURRENT)[name], minutes_by_player(league, COMPLETED[-1]).get(name)
    earlier, last = metrics(CURRENT), metrics(COMPLETED[-1])
    row = {"team": name, "now": {k: earlier.get(k) for k in METRICS}, "last": {k: last.get(k) for k in METRICS} if last else None}
    row["games"] = [{"opponent": other["name"], "margin": team["score"] - other["score"]}
                    for game in load(league, CURRENT) for team, other in sides(game) if team["name"] == name]
    ppg = lambda p: round(p["points"] / p["games"], 1)
    current_all, previous_all = minutes_by_player(league, CURRENT), minutes_by_player(league, COMPLETED[-1])
    team_of = lambda rosters, pid: next((team for team, players in rosters.items() if pid in players), None)
    # Who arrived, who has not played and who grew: picked by the numbers, so the article cannot choose favourably.
    new = [(i, p) for i, p in now.items() if not before or i not in before]
    row["arrivals"] = [{"name": p["name"], "ppg": ppg(p), "from": team_of(previous_all, i)} for i, p in sorted(new, key=lambda item: -ppg(item[1])) if p["games"] >= 2][:3]
    if before:
        row["returningShare"] = round(100 * sum(p["minutes"] for i, p in now.items() if i in before) / sum(p["minutes"] for p in now.values()))
        gone = [(i, p) for i, p in before.items() if i not in now and p["games"] >= 5]
        row["absent"] = [{"name": p["name"], "ppg": ppg(p), "now": team_of(current_all, i)} for i, p in sorted(gone, key=lambda item: -ppg(item[1]))[:3]]
        grew = [(i, p) for i, p in now.items() if i in before and p["games"] >= 2 and ppg(p) - ppg(before[i]) >= 4]
        row["risers"] = [{"name": p["name"], "from": ppg(before[i]), "to": ppg(p)} for i, p in sorted(grew, key=lambda item: ppg(before[item[0]]) - ppg(item[1]))[:2]]
    return row


def league_report(league):
    rows = [row for season in COMPLETED for row in team_seasons(league, season)]
    pick = lambda key, group: [row[key] for row in group]
    lowest = min(rows, key=lambda row: row["restWinPct"])
    trimmed = [row for row in rows if row is not lowest]
    mean = sum(pick("restWinPct", rows)) / len(rows)
    current, previous = table(league, CURRENT), table(league, COMPLETED[-1])
    standings = sorted(current.items(), key=lambda item: (-item[1]["wins"] / (item[1]["wins"] + item[1]["losses"]), -item[1]["diff"]))
    return {"rows": rows, "teamSeasons": len(rows),
            "corrMargin": round(corr(pick("margin", rows), pick("restWinPct", rows)), 2),
            "corrWins": round(corr(pick("wins", rows), pick("restWinPct", rows)), 2),
            "bySeason": {s: round(corr(pick("margin", g), pick("restWinPct", g)), 2)
                         for s in COMPLETED for g in [[r for r in rows if r["season"] == s]]},
            "withoutLowest": {"team": lowest["team"], "season": lowest["season"], "corrMargin": round(corr(pick("margin", trimmed), pick("restWinPct", trimmed)), 2)},
            "spread": round((sum((v - mean) ** 2 for v in pick("restWinPct", rows)) / len(rows)) ** 0.5, 1),
            "seasonLength": season_length(league), "changes": [team_change(league, name) for name in EXAMPLES[league]],
            "games": len(load(league, CURRENT)), "asOf": load(league, CURRENT)[-1]["date"][:10],
            "standings": [{"team": name, **row, **({"lastSeason": f'{previous[name]["wins"]}–{previous[name]["losses"]}'} if name in previous else {})}
                          for name, row in standings]}


OUT.write_text(json.dumps({"women": league_report("women"), "men": league_report("men")}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(OUT)
