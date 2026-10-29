"""Tune game-to-game form on 2024–25, lock it, then compare once on 2025–26. (KOR-16)

python3 -m simulation.tune_form --possessions-2024 P24.json --lock v1
python3 -m simulation.tune_form --possessions-2024 P24.json --possessions-2025 P25.json --evaluate v1

Selection rule, fixed before the grid runs: among spreads whose 2024–25 Brier is at most 0.001 worse than
no form, take the one whose player 80 % interval coverage is closest to 0.80 (ties: lower Brier). Form is
meant to make the ranges honest, not to chase wins. `--evaluate` reports the same game set as player-sim-v1
with coverage and margin spread before and after.
"""
import argparse
from datetime import datetime, timezone
from itertools import product
import json
from pathlib import Path
from statistics import mean, pstdev

from simulation.evaluate import interval_coverage, walk_forward
from simulation.history import load_season
from simulation.tune import RECORDS, SIMULATIONS, digest, evaluable, outcome

FOLDER = Path("learning/forecasting")
RESULTS = FOLDER / "results"
GRID = {"shot": (0.0, 0.05, 0.1, 0.15, 0.2), "usage": (0.0, 0.1, 0.2, 0.3), "defense": (0.0, 0.04, 0.08)}
RULE = "Brier within 0.001 of no form on 2024-25, then player 80% interval coverage closest to 0.80, then lower Brier"


def score(simulated, games, keep):
    rows = [(simulated[g["match_id"]]["home_win_probability"], outcome(g)) for g in games if g["match_id"] in keep and g["match_id"] in simulated]
    return round(mean((p - won) ** 2 for p, won in rows), 4), len(rows)


def lock(args):
    path = FOLDER / f"model-lock-player-form-{args.version}.json"
    if path.exists():
        raise SystemExit(f"{path.name} is already locked. A new experiment needs a new version.")
    games = load_season(RECORDS["2024-25"], args.possessions_2024, 1.0)
    keep, grid = evaluable(games), []
    for values in product(*GRID.values()):
        form = dict(zip(GRID, values))
        simulated = walk_forward([], games, SIMULATIONS, form=form)
        brier, n = score(simulated, games, keep)
        grid.append({"form": form, "games": n, "brier": brier, "coverage": interval_coverage(simulated, games)})
        print(json.dumps(grid[-1]))
    baseline = next(row for row in grid if not any(row["form"].values()))
    allowed = [row for row in grid if row["brier"] <= baseline["brier"] + 0.001]
    best = min(allowed, key=lambda row: (abs(row["coverage"] - 0.8), row["brier"]))
    payload = {"version": f"player-form-{args.version}", "selected_on": "2024-25 walk-forward, no earlier history", "rule": RULE,
               "simulations": SIMULATIONS, "grid": GRID, "results": grid, "baseline": baseline, "selected": best, "form": best["form"],
               "locked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
               "sources_sha256": {"records": digest(RECORDS["2024-25"]), "possessions": digest(args.possessions_2024)},
               "note": "2025-26 was not read when this file was written."}
    with path.open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(payload, ensure_ascii=False, indent=1) + "\n")
    print(json.dumps({"baseline": baseline, "selected": best}, ensure_ascii=False))


def summary(simulated, games, locked_ids):
    rows = [g for g in games if g["match_id"] in locked_ids and g["match_id"] in simulated]
    probabilities = [(simulated[g["match_id"]]["home_win_probability"], outcome(g)) for g in rows]
    z = []
    for g in rows:
        sim = simulated[g["match_id"]]
        result = {t["source_id"]: t["score"] for t in g["record"]["teams"]}
        margin = result[g["home"]] - max(v for k, v in result.items() if k != g["home"])
        if sim["margin_sd"]:
            z.append((margin - sim["mean_margin"]) / sim["margin_sd"])
    calibration = []
    for low in (0.0, 0.2, 0.4, 0.6, 0.8):
        group = [(p, won) for p, won in probabilities if low <= p < low + 0.2 or (low == 0.8 and p == 1)]
        if group:
            calibration.append({"range": f"{low:.1f}-{low + 0.2:.1f}", "matches": len(group), "mean_probability": round(mean(p for p, _ in group), 3),
                                "home_win_rate": round(mean(won for _, won in group), 3)})
    return {"matches": len(rows), "brier": round(mean((p - won) ** 2 for p, won in probabilities), 4),
            "player_interval_coverage": interval_coverage(simulated, rows), "margin_z_sd": round(pstdev(z), 3),
            "mean_margin_sd": round(mean(simulated[g["match_id"]]["margin_sd"] for g in rows), 2), "calibration": calibration}


def evaluate(args):
    locked = json.loads((FOLDER / f"model-lock-player-form-{args.version}.json").read_text(encoding="utf-8"))
    history = load_season(RECORDS["2024-25"], args.possessions_2024, 0.5)
    target = load_season(RECORDS["2025-26"], args.possessions_2025, 1.0)
    ids = {p["match_id"] for p in json.loads((RESULTS / "player-sim-v1.json").read_text(encoding="utf-8"))["predictions"]}
    before, after = walk_forward(history, target, SIMULATIONS), walk_forward(history, target, SIMULATIONS, form=locked["form"])
    report = {"version": locked["version"], "season": "2025-26", "simulations_per_match": SIMULATIONS, "form": locked["form"],
              "history": "2024-25 weight 0.5, earlier 2025-26 days weight 1", "without_form": summary(before, target, ids),
              "with_form": summary(after, target, ids), "margin_model_brier": 0.2329,
              "predictions": [{"match_id": g["match_id"], "player_simulation": after[g["match_id"]]["home_win_probability"], "home_won": outcome(g)}
                              for g in target if g["match_id"] in ids and g["match_id"] in after]}
    with (RESULTS / f"player-form-{args.version}.json").open("x", encoding="utf-8") as stream:
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
