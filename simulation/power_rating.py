"""Team strength with the schedule taken into account, tuned on 2024-25 and compared once on 2025-26. (KOR-30)

python3 -m simulation.power_rating --lock v1
python3 -m simulation.power_rating --evaluate v1

Every game says: home margin = home edge + home rating - away rating + noise. Solving that for all games together
is what corrects for the schedule. `shrink` pulls ratings toward zero, as if each team had that many extra even games,
so a short season cannot produce an extreme rating. Each game is predicted from earlier days only.
"""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
from itertools import product
import json
from math import erf, sqrt
from pathlib import Path
from statistics import mean

from simulation.refresh import LEAGUES
from simulation.win_probability import load

FOLDER = Path("learning/forecasting")
RESULTS = FOLDER / "results"
GRID = {"shrink": (0.1, 0.25, 0.5, 1, 2, 3, 5, 8, 12, 20), "home": (0, 1, 2, 3, 4, 5, 6), "sigma": tuple(range(8, 21))}
AVERAGE_GRID = {"shrink": (1, 2, 3, 5, 8, 12), "home": GRID["home"], "sigma": GRID["sigma"]}
MIN_GAMES = 5  # Same rule as the earlier comparisons.


def invert(matrix):
    """Gauss-Jordan; the shrink term keeps the matrix invertible, and the league has about a dozen teams."""
    size = len(matrix)
    work = [list(row) + [float(i == j) for j in range(size)] for i, row in enumerate(matrix)]
    for col in range(size):
        pivot = max(range(col, size), key=lambda r: abs(work[r][col]))
        work[col], work[pivot] = work[pivot], work[col]
        divisor = work[col][col]
        work[col] = [v / divisor for v in work[col]]
        for row in range(size):
            if row != col and work[row][col]:
                factor = work[row][col]
                work[row] = [a - factor * b for a, b in zip(work[row], work[col])]
    return [row[size:] for row in work]


def fit(results, shrink, home):
    """`results` are (home team, away team, home margin). Returns the ratings and each rating's variance factor."""
    teams = sorted({t for r in results for t in r[:2]})
    index = {t: i for i, t in enumerate(teams)}
    size = len(teams)
    normal = [[shrink * (i == j) for j in range(size)] for i in range(size)]
    target = [0.0] * size
    for a, b, margin in results:
        i, j = index[a], index[b]
        normal[i][i] += 1
        normal[j][j] += 1
        normal[i][j] -= 1
        normal[j][i] -= 1
        target[i] += margin - home
        target[j] -= margin - home
    inverse = invert(normal)
    ratings = {t: sum(inverse[index[t]][k] * target[k] for k in range(size)) for t in teams}
    return ratings, {t: inverse[index[t]][index[t]] for t in teams}


def averages(results, shrink, home):
    """The comparison: a team's average margin, shrunk the same way, with no schedule correction."""
    total, games = defaultdict(float), Counter()
    for a, b, margin in results:
        total[a] += margin - home
        total[b] -= margin - home
        games[a] += 1
        games[b] += 1
    return {t: total[t] / (games[t] + shrink) for t in total}, None


def home_probability(gap, home, sigma):
    return 0.5 * (1 + erf((gap + home) / (sigma * sqrt(2))))


def days(games):
    grouped = defaultdict(list)
    for game in games:
        score = {t["source_id"]: t["score"] for t in game["record"]["teams"]}
        away = next(t for t in score if t != game["home"])
        grouped[game["date"]].append((game["match_id"], game["home"], away, score[game["home"]] - score[away]))
    return [grouped[day] for day in sorted(grouped)]


def gaps(games, model, shrink, home):
    """Walk forward: (match, home's rating minus away's, margin), for games where both teams have enough earlier games."""
    results, played, rows = [], Counter(), []
    for today in days(games):
        ratings = None
        for match, a, b, margin in today:
            if played[a] >= MIN_GAMES and played[b] >= MIN_GAMES:
                ratings = ratings or model(results, shrink, home)[0]
                rows.append((match, ratings[a] - ratings[b], margin))
        for _, a, b, margin in today:
            results.append((a, b, margin))
            played[a] += 1
            played[b] += 1
    return rows


def brier(rows, home, sigma):
    return mean((home_probability(gap, home, sigma) - (margin > 0)) ** 2 for _, gap, margin in rows)


def tune(games, model, grid):
    best = None
    for shrink, home in product(grid["shrink"], grid["home"]):
        rows = gaps(games, model, shrink, home)
        for sigma in grid["sigma"]:
            score = round(brier(rows, home, sigma), 5)
            if best is None or score < best["brier"]:
                best = {"shrink": shrink, "home": home, "sigma": sigma, "brier": score, "games": len(rows)}
    return best


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def lock(version):
    path = FOLDER / f"model-lock-power-rating-{version}.json"
    if path.exists():
        raise SystemExit(f"{path.name} is already locked. A new experiment needs a new version.")
    payload = {"version": f"power-rating-{version}", "selected_on": "2024-25", "grid": GRID, "leagues": {},
               "locked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "note": "2025-26 was not read when this file was written."}
    for league in LEAGUES:
        games, source = load(league, "2024-25")
        payload["leagues"][league] = {"rating": tune(games, fit, GRID), "average_margin": tune(games, averages, AVERAGE_GRID), "source_sha256": digest(source)}
    with path.open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(payload, ensure_ascii=False, indent=1) + "\n")
    print(json.dumps(payload["leagues"], indent=1))


def evaluate(version):
    locked = json.loads((FOLDER / f"model-lock-power-rating-{version}.json").read_text(encoding="utf-8"))
    report = {"version": locked["version"], "season": "2025-26", "rule": f"both teams have {MIN_GAMES} earlier games; same-day results excluded", "leagues": {}}
    for league, lock_row in locked["leagues"].items():
        games, _ = load(league, "2025-26")
        line = {}
        for name, model in (("rating", fit), ("average_margin", averages)):
            params = lock_row[name]
            rows = gaps(games, model, params["shrink"], params["home"])
            line[name] = {"games": len(rows), "brier": round(brier(rows, params["home"], params["sigma"]), 4),
                          "favorites_correct": round(mean((gap + params["home"] > 0) == (margin > 0) for _, gap, margin in rows), 3)}
        report["leagues"][league] = line
    with (RESULTS / f"power-rating-{version}.json").open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(report, ensure_ascii=False, indent=1) + "\n")
    print(json.dumps(report["leagues"], indent=1))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--lock")
    group.add_argument("--evaluate")
    args = parser.parse_args()
    lock(args.lock) if args.lock else evaluate(args.evaluate)
