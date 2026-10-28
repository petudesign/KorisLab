"""Tune the player simulator's priors on 2024–25 only, lock them, then compare once on 2025–26. (KOR-11)

python3 -m simulation.tune --possessions-2024 P24.json --lock v2
python3 -m simulation.tune --possessions-2024 P24.json --possessions-2025 P25.json --evaluate v2

`--lock` never reads 2025–26 and refuses to overwrite an existing lock. `--evaluate` uses only the
locked values, on the same 161 games as player-sim-v1, and writes results/player-sim-NAME.json once.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
from itertools import product
import json
from pathlib import Path
from statistics import mean

from simulation.evaluate import walk_forward
from simulation.history import load_season
from simulation.player_sim import PRIORS

FOLDER = Path("learning/forecasting")
RESULTS = FOLDER / "results"
RECORDS = {"2024-25": "data/normalized/season_korisliiga_2024_2025.json", "2025-26": "data/normalized/season_korisliiga_2025_2026.json"}
# Team factors decide how fast a new roster's results move the forecast; per-minute and usage priors decide
# how much a short sample of a new player counts. These are where the error analysis pointed.
GRID = {"team": (40, 80, 150, 300), "per_minute": (40, 80, 160), "usage_minutes": (30, 60, 120)}
SIMULATIONS = 400


def brier(rows):
    return mean((p - won) ** 2 for p, won in rows)


def evaluable(games):
    """Same rule as the frozen comparison: both teams have five earlier games; same-day results excluded."""
    seen, keep = Counter(), set()
    for day in sorted({g["date"] for g in games}):
        today = [g for g in games if g["date"] == day]
        for g in today:
            teams = [t["source_id"] for t in g["record"]["teams"]]
            if all(seen[t] >= 5 for t in teams):
                keep.add(g["match_id"])
        for g in today:
            seen.update(t["source_id"] for t in g["record"]["teams"])
    return keep


def outcome(game):
    score = {t["source_id"]: t["score"] for t in game["record"]["teams"]}
    return int(score[game["home"]] > max(v for k, v in score.items() if k != game["home"]))


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def lock(args):
    path = FOLDER / f"model-lock-player-sim-{args.version}.json"
    if path.exists():
        raise SystemExit(f"{path.name} is already locked. A new experiment needs a new version.")
    games = load_season(RECORDS["2024-25"], args.possessions_2024, 1.0)
    keep, outcomes = evaluable(games), {g["match_id"]: outcome(g) for g in games}
    grid = []
    for values in product(*GRID.values()):
        priors = dict(zip(GRID, values))
        simulated = walk_forward([], games, SIMULATIONS, priors)
        rows = [(simulated[m]["home_win_probability"], outcomes[m]) for m in keep if m in simulated]
        grid.append({"priors": priors, "games": len(rows), "brier": round(brier(rows), 4)})
        print(json.dumps(grid[-1]))
    best = min(grid, key=lambda row: (row["brier"], json.dumps(row["priors"])))
    locked = {**PRIORS, **best["priors"]}
    payload = {"version": f"player-sim-{args.version}", "selected_on": "2024-25 walk-forward, no earlier history",
               "evaluation_rule": "both teams have five earlier games; same-day results excluded",
               "simulations": SIMULATIONS, "grid": GRID, "results": grid, "selected": best, "priors": locked,
               "locked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
               "sources_sha256": {"records": digest(RECORDS["2024-25"]), "possessions": digest(args.possessions_2024)},
               "note": "2025-26 was not read when this file was written."}
    with path.open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(payload, ensure_ascii=False, indent=1) + "\n")
    print(json.dumps({"selected": best, "priors": locked}, ensure_ascii=False))


def evaluate(args):
    locked = json.loads((FOLDER / f"model-lock-player-sim-{args.version}.json").read_text(encoding="utf-8"))
    history = load_season(RECORDS["2024-25"], args.possessions_2024, 0.5)
    target = load_season(RECORDS["2025-26"], args.possessions_2025, 1.0)
    frozen = json.loads((RESULTS / "possession-sim-v2.json").read_text(encoding="utf-8"))["predictions"]
    v1 = {p["match_id"]: p["player_simulation"] for p in json.loads((RESULTS / "player-sim-v1.json").read_text(encoding="utf-8"))["predictions"]}
    simulated = walk_forward(history, target, SIMULATIONS, locked["priors"])
    rows = [{**p, "player_sim_v1": v1[p["match_id"]], "player_sim": simulated[p["match_id"]]["home_win_probability"]}
            for p in frozen if p["match_id"] in v1 and p["match_id"] in simulated]
    score = lambda key: round(mean((r[key] - r["home_won"]) ** 2 for r in rows), 4)
    report = {"version": locked["version"], "season": "2025-26", "matches": len(rows), "simulations_per_match": SIMULATIONS,
              "history": "2024-25 weight 0.5, earlier 2025-26 days weight 1", "priors": locked["priors"],
              "metrics_brier": {"player_sim_v2": score("player_sim"), "player_sim_v1": score("player_sim_v1"),
                                "margin_home_locked": score("margin_home_probability"), "elo_k32": score("home_win_probability")},
              "favorites_correct": sum((r["player_sim"] > 0.5) == bool(r["home_won"]) for r in rows if r["player_sim"] != 0.5),
              "predictions": [{"match_id": r["match_id"], "player_simulation": r["player_sim"], "home_won": r["home_won"]} for r in rows]}
    with (RESULTS / f"player-sim-{args.version}.json").open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "predictions"}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--possessions-2024", type=Path, required=True)
    parser.add_argument("--possessions-2025", type=Path)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--lock", dest="version_lock")
    group.add_argument("--evaluate", dest="version_eval")
    args = parser.parse_args()
    args.version = args.version_lock or args.version_eval
    lock(args) if args.version_lock else evaluate(args)
