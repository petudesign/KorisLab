"""Win probability during a game, from the score, the clock and the teams' earlier results. (KOR-29)

python3 -m simulation.win_probability --lock v1       # tune on 2024-25 only; refuses to overwrite a lock
python3 -m simulation.win_probability --evaluate v1   # one comparison on 2025-26; written once

The final margin is treated as normal around (current margin + expected margin in the time left), with spread
sigma * sqrt(share of game left). Three parameters per league: sigma, how much pre-game strength counts, home edge.
It does not know who has the ball, fouls, lineups or timeouts. Those are limits a reader should be told about.
"""
import argparse
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
from itertools import product
import json
from math import erf, sqrt
from pathlib import Path
from statistics import mean

from simulation.history import join_season
from simulation.refresh import HISTORY_DIR, LEAGUES, matches, read_history, site_dates

FOLDER = Path("learning/forecasting")
RESULTS = FOLDER / "results"
REGULATION = 2400
SHRINK_GAMES = 5  # Same zero-margin start as the locked margin model.
GRID = {"sigma": tuple(range(8, 21)), "strength": (0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8), "home": (0, 1, 2, 3, 4, 5)}
CHECKPOINTS = {"start": 2400, "q1": 1800, "half": 1200, "q3": 600, "4min": 240, "1min": 60}


def home_win_probability(margin, seconds_left, expected, sigma):
    """`expected` is the pre-game expected home margin; only the part for the time left still counts."""
    share = max(seconds_left, 0) / REGULATION
    if share == 0:
        return 1.0 if margin > 0 else 0.0 if margin < 0 else 0.5
    return 0.5 * (1 + erf((margin + expected * share) / (sigma * sqrt(share) * sqrt(2))))


def seconds_left(period, clock):
    """Overtime is numbered oddly in the source (period 11), so anything past four counts as its own five minutes."""
    return (4 - period) * 600 + clock if period <= 4 else clock


def game_states(game):
    """Every moment the score or the clock moved: (period, clock, seconds left, home margin, event).

    Technical free throws are not part of possessions, so any points the quarter score has beyond
    the events are added at the end of that quarter. That keeps every quarter and the final exact."""
    record, home = game["record"], game["home"]
    quarter_scores = {p["period"]: p["home_score"] - p["away_score"] for p in record["game"].get("periods") or []}
    states, margin, last_period, period_start = [(1, 600.0, REGULATION, 0, None)], 0, 1, 0

    def close_period(period, margin):
        if period not in quarter_scores:
            return margin
        wanted = period_start + quarter_scores[period]
        if wanted != margin:
            states.append((period, 0.0, seconds_left(period, 0.0), wanted, None))
        return wanted
    for possession in game["possessions"]:
        for event in possession["events"]:
            # A possession can run over a quarter break, so its label is not enough: a clock that jumps back up is a new period.
            period = max(possession["period"], last_period)
            if period == last_period and event["clock"] > states[-1][1] + 30:
                period = 11 if last_period >= 4 else last_period + 1
            if period != last_period:
                margin = close_period(last_period, margin)
                period_start, last_period = margin, period
                states.append((period, 300.0 if period > 4 else 600.0, seconds_left(period, 300.0 if period > 4 else 600.0), margin, None))
            points = {"2pt": 2, "3pt": 3, "free_throw": 1}.get(event["type"], 0) if event.get("made") else 0
            margin += points if event["team"] == home else -points
            states.append((period, event["clock"], seconds_left(period, event["clock"]), margin, event))
    margin = close_period(last_period, margin)
    final = {t["source_id"]: t["score"] for t in record["teams"]}
    away = next(t for t in final if t != home)
    if margin != final[home] - final[away]:  # Sources without quarter scores: settle the small rest at the buzzer.
        margin = final[home] - final[away]
        states.append((last_period, 0.0, 0.0, margin, None))
    return states


def expected_inputs(games):
    """Each game's strength gap from earlier days only, shrunk toward zero for small samples."""
    totals, counts, gaps = defaultdict(float), defaultdict(int), {}
    days = defaultdict(list)
    for game in games:
        days[game["date"]].append(game)
    for day in sorted(days):
        rows = []
        for game in days[day]:
            score = {t["source_id"]: t["score"] for t in game["record"]["teams"]}
            away = next(t for t in score if t != game["home"])
            rating = lambda team: totals[team] / (counts[team] + SHRINK_GAMES)
            gaps[game["match_id"]] = rating(game["home"]) - rating(away)
            rows.append((game["home"], away, score[game["home"]] - score[away]))
        for home, away, margin in rows:
            totals[home] += margin
            totals[away] -= margin
            counts[home] += 1
            counts[away] += 1
    return gaps


def samples(games):
    """One state per game minute, so every game and every stage counts the same."""
    gaps, rows = expected_inputs(games), []
    for game in games:
        states = [s for s in game_states(game) if s[0] <= 4]
        final = game_states(game)[-1][3]
        marks, index = [], 0
        for left in range(REGULATION, -1, -60):
            while index + 1 < len(states) and states[index + 1][2] >= left:
                index += 1
            marks.append((left, states[index][3]))
        won = final > 0
        rows.append({"match_id": game["match_id"], "gap": gaps[game["match_id"]], "won": won, "marks": marks})
    return rows


def predict(row, left, margin, params):
    expected = params["home"] + params["strength"] * row["gap"]
    return home_win_probability(margin, left, expected, params["sigma"])


def brier(rows, params, only=None):
    errors = [(predict(r, left, margin, params) - r["won"]) ** 2 for r in rows for left, margin in r["marks"] if only is None or left == only]
    return round(mean(errors), 4)


def calibration(rows, params):
    groups = defaultdict(list)
    for r in rows:
        for left, margin in r["marks"]:
            if 0 < left < REGULATION:
                p = predict(r, left, margin, params)
                groups[min(int(p * 10), 9)].append((p, r["won"]))
    return [{"range": f"{b / 10:.1f}-{(b + 1) / 10:.1f}", "states": len(g), "mean_probability": round(mean(p for p, _ in g), 3), "home_win_rate": round(mean(w for _, w in g), 3)}
            for b, g in sorted(groups.items())]


def load(league, season):
    config = LEAGUES[league]
    path = next(p for s, p, _ in config["history"] if s == season)
    return join_season(matches(path), read_history(config["slug"], season), 1.0, site_dates(league, season)), path


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def lock(version):
    path = FOLDER / f"model-lock-win-probability-{version}.json"
    if path.exists():
        raise SystemExit(f"{path.name} is already locked. A new experiment needs a new version.")
    payload = {"version": f"win-probability-{version}", "selected_on": "2024-25", "grid": GRID, "leagues": {},
               "note": "2025-26 was not read when this file was written.", "locked_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    for league in LEAGUES:
        games, source = load(league, "2024-25")
        rows = samples(games)
        grid = [dict(zip(GRID, values)) for values in product(*GRID.values())]
        best = min(grid, key=lambda params: (brier(rows, params), params["sigma"], params["strength"], params["home"]))
        payload["leagues"][league] = {"params": best, "games": len(rows), "brier": brier(rows, best), "source_sha256": digest(source),
                                      "possessions_sha256": digest(HISTORY_DIR / f"possessions-{LEAGUES[league]['slug']}-2024-25.json.gz")}
        print(league, payload["leagues"][league]["params"], payload["leagues"][league]["brier"], flush=True)
    with path.open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(payload, ensure_ascii=False, indent=1) + "\n")


def evaluate(version):
    locked = json.loads((FOLDER / f"model-lock-win-probability-{version}.json").read_text(encoding="utf-8"))
    report = {"version": locked["version"], "season": "2025-26", "leagues": {}}
    for league in LEAGUES:
        rows = samples(load(league, "2025-26")[0])
        params = locked["leagues"][league]["params"]
        score_only = {**params, "strength": 0.0, "home": 0}
        report["leagues"][league] = {
            "games": len(rows), "params": params, "brier_all_minutes": brier(rows, params), "brier_score_only": brier(rows, score_only),
            "brier_by_moment": {name: brier(rows, params, left) for name, left in CHECKPOINTS.items()},
            "brier_by_moment_score_only": {name: brier(rows, score_only, left) for name, left in CHECKPOINTS.items()},
            "calibration": calibration(rows, params)}
    with (RESULTS / f"win-probability-{version}.json").open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(report, ensure_ascii=False, indent=1) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--lock")
    group.add_argument("--evaluate")
    args = parser.parse_args()
    lock(args.lock) if args.lock else evaluate(args.evaluate)
