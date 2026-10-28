"""Parallel walk-forward runs of the player simulator, keeping each game's full margin distribution.

Same rule as `simulation.backtest`: a game is predicted from games on earlier days only. Days are
independent once their history is fixed, so they run in separate processes. `priors` overrides
entries of `player_sim.PRIORS` for a tuning run; the defaults are the locked values.
"""
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
import os
from statistics import mean, pstdev

from simulation import player_sim

_history = _target = None


def _init(history, target):
    global _history, _target
    _history, _target = history, target


def _day(args):
    day, simulations, priors = args
    player_sim.PRIORS.update(priors or {})
    earlier = [g for g in _history if g["date"] < day] + sorted((g for g in _target if g["date"] < day), key=lambda g: g["date"])
    if not earlier:
        return {}
    model = player_sim.PlayerModel(earlier)
    output = {}
    for game in (g for g in _target if g["date"] == day):
        record = game["record"]
        away = next(t["source_id"] for t in record["teams"] if t["source_id"] != game["home"])
        try:
            simulator = player_sim.GameSimulator(model, game["home"], away)
        except (ValueError, AttributeError):
            continue
        results = [simulator.play(seed) for seed in range(simulations)]
        margins = sorted(r["score"][game["home"]] - r["score"][away] for r in results)
        points = defaultdict(float)
        for result in results:
            for pid, values in result["stats"].items():
                points[pid] += values.get("points", 0) / simulations
        output[game["match_id"]] = {
            "home_win_probability": mean(r["score"][game["home"]] > r["score"][away] for r in results),
            "mean_margin": mean(margins), "margin_sd": pstdev(margins),
            "margin_p10": margins[int(0.1 * len(margins))], "margin_p90": margins[int(0.9 * len(margins))],
            "mean_total": mean(sum(r["score"].values()) for r in results), "player_points": dict(points)}
    return output


def walk_forward(history, target, simulations=400, priors=None, workers=None):
    days = sorted({g["date"] for g in target})
    output = {}
    with ProcessPoolExecutor(workers or os.cpu_count(), initializer=_init, initargs=(history, target)) as pool:
        for part in pool.map(_day, [(day, simulations, priors) for day in days]):
            output.update(part)
    return output
