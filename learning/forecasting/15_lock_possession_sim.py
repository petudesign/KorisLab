"""Valitse hallintasimulaattorin parametrit kaudella 2024–25 ja lukitse ne kerran.

Aja projektin juuresta:
python3 learning/forecasting/15_lock_possession_sim.py --possessions polku/possessions-2024-25.json

Valinta tehdään vain 2024–25 tuloksilla. Kautta 2025–26 ei lueta, joten
lukitun version vertailu `14_possession_sim_backtest.py --lock ...` on ennalta sovittu.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from zoneinfo import ZoneInfo

from elo_backtest import checked_matches, evaluate, run_backtest
from possession_sim import walk_forward

PRIORS = (15, 30, 60, 120)
SHOCKS = (0.0, 0.05, 0.1, 0.15, 0.2, 0.3)

folder = Path(__file__).resolve().parent
root = folder.parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--possessions", type=Path, required=True)
parser.add_argument("--simulations", type=int, default=1000)
parser.add_argument("--version", default="v2")
args = parser.parse_args()
lock_path = folder / f"model-lock-possession-sim-{args.version}.json"
if lock_path.exists():
    raise SystemExit(f"{lock_path.name} on jo lukittu. Uusi kokeilu tarvitsee uuden version.")

source = root / "prototypes/paper-home/public/data/men-2024-25-matches.json"
matches = json.loads(source.read_text(encoding="utf-8"))
for match in matches:
    date = datetime.fromisoformat(match["date"])
    if date.tzinfo is None:
        match["date"] = date.replace(tzinfo=ZoneInfo("Europe/Helsinki")).isoformat()
matches = checked_matches(matches)
possessions = json.loads(args.possessions.read_text(encoding="utf-8"))
by_match = {game["match_id"]: game["possessions"] for game in possessions["games"]}
elo = run_backtest(matches)
subset = [p for p in elo["predictions"] if p["both_have_five"]]

grid = []
for prior in PRIORS:
    for shock in SHOCKS:
        simulated = walk_forward(matches, by_match, args.simulations, prior=prior, shock=shock)
        rows = [{"match_id": p["match_id"], "home_win_probability": simulated[p["match_id"]]["home_win_probability"]} for p in subset]
        result = evaluate(rows, elo["outcomes"])
        grid.append({"prior": prior, "shock": shock, "brier": result["brier"], "correct": result["correct"]})
        print(json.dumps(grid[-1]), flush=True)
best = min(grid, key=lambda row: row["brier"])
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
lock = {
    "version": f"possession-sim-{args.version}", "locked_at": datetime.now(timezone.utc).isoformat(),
    "training_season": "2024-25", "training_matches": len(subset), "possession_games": len(by_match),
    "parameters": {"prior": best["prior"], "pace_prior": 600, "shock": best["shock"]},
    "selection": "lowest Brier, both teams with five earlier matches, same-day results excluded",
    "simulations_during_selection": args.simulations, "grid": grid,
    "sources_sha256": {"matches": sha(source), "possessions": sha(args.possessions),
                       "possession_sim.py": sha(folder / "possession_sim.py")},
    "elo_k32_brier_same_matches": evaluate(subset, elo["outcomes"])["brier"],
}
with lock_path.open("x", encoding="utf-8") as stream:
    stream.write(json.dumps(lock, ensure_ascii=False, indent=2) + "\n")
print(f"Lukittu {lock_path.name}: {lock['parameters']}")
