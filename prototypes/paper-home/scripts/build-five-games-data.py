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


def load(league, season):
    games = json.loads((DATA / f"{league}-{season}-matches.json").read_text(encoding="utf-8"))
    return sorted((g for g in games if g.get("verified")), key=lambda g: g["date"])


def corr(x, y):
    mx, my = sum(x) / len(x), sum(y) / len(y)
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / (sum((a - mx) ** 2 for a in x) * sum((b - my) ** 2 for b in y)) ** 0.5


def sides(game):
    a, b = game["teams"]
    return ((a, b), (b, a))


def team_seasons(league, season):
    """First five recorded games against the rest of the same regular season."""
    played, early, wins, rest = defaultdict(int), defaultdict(int), defaultdict(int), defaultdict(list)
    for game in load(league, season):
        for team, other in sides(game):
            margin = team["score"] - other["score"]
            if played[team["name"]] < 5:
                early[team["name"]] += margin
                wins[team["name"]] += margin > 0
            else:
                rest[team["name"]].append(margin > 0)
            played[team["name"]] += 1
    return [{"team": name, "season": season, "wins": wins[name], "margin": round(early[name] / 5, 1),
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
            "games": len(load(league, CURRENT)), "asOf": load(league, CURRENT)[-1]["date"][:10],
            "standings": [{"team": name, **row, **({"lastSeason": f'{previous[name]["wins"]}–{previous[name]["losses"]}'} if name in previous else {})}
                          for name, row in standings]}


OUT.write_text(json.dumps({"women": league_report("women"), "men": league_report("men")}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(OUT)
