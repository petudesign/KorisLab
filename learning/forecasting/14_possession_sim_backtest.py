"""Vertaa hallintasimulaattoria Eloon ja lukittuun piste-eromalliin kaudella 2025–26.

Aja projektin juuresta:
python3 learning/forecasting/14_possession_sim_backtest.py --possessions polku/possessions.json

Hallinnat tuotetaan komennolla `python3 -m ingestion.publish_possessions`.
v1:n parametrit (prior=30, pace_prior=600, ei virettä, 2000 simulaatiota, siemen 0)
valittiin etukäteen. Myöhemmät parametrit luetaan --lock-tiedostosta, joka on
sovitettu aiempaan kauteen. Kumpaakaan ei sovitettu tämän kauden tuloksiin.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from statistics import mean
from zoneinfo import ZoneInfo

from comparison_models import margin_features, sigmoid
from elo_backtest import checked_matches, evaluate, run_backtest
from possession_sim import walk_forward

folder = Path(__file__).resolve().parent
root = folder.parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--possessions", type=Path, required=True)
parser.add_argument("--simulations", type=int, default=2000)
parser.add_argument("--lock", type=Path, help="Lukittu parametritiedosto; ilman sitä käytetään v1:n parametreja")
parser.add_argument("--freeze", help="Tallenna lukittu kopio nimellä results/possession-sim-NIMI.json; ei korvaa vanhaa")
args = parser.parse_args()

matches = json.loads((root / "prototypes/paper-home/public/data/men-2025-26-matches.json").read_text(encoding="utf-8"))
for match in matches:
    date = datetime.fromisoformat(match["date"])
    if date.tzinfo is None:
        match["date"] = date.replace(tzinfo=ZoneInfo("Europe/Helsinki")).isoformat()
matches = checked_matches(matches)
possessions = json.loads(args.possessions.read_text(encoding="utf-8"))
by_match = {game["match_id"]: game["possessions"] for game in possessions["games"]}

elo = run_backtest(matches)
outcomes = elo["outcomes"]
lock = json.loads((folder / "model-lock-men-v1.json").read_text(encoding="utf-8"))["models"]["margin_home"]
margin_rows = {row["match_id"]: row for row in margin_features(matches)[0]}

params = {"prior": 30, "pace_prior": 600, "shock": 0.0}
if args.lock:
    params = json.loads(args.lock.read_text(encoding="utf-8"))["parameters"]
simulated = walk_forward(matches, by_match, args.simulations, **params)

predictions = []
for prediction in elo["predictions"]:
    sim = simulated[prediction["match_id"]]
    margin = margin_rows[prediction["match_id"]]["margin_feature"]
    predictions.append({**prediction, "simulation_probability": sim["home_win_probability"],
                        "margin_home_probability": sigmoid(lock["bias"] + lock["slope"] * margin),
                        "simulated_margin": sim["mean_margin"], "simulated_total": sim["mean_total"]})
subset = [p for p in predictions if p["both_have_five"]]
models = {"possession_simulation": "simulation_probability", "elo_k32": "home_win_probability",
          "margin_home_locked": "margin_home_probability", "home_rate": "historical_home_probability",
          "flat": "flat_probability"}
metrics = {name: evaluate(subset, outcomes, key) for name, key in models.items()}
scored = [p for p in subset if p["simulated_total"] is not None]
actual_margin = lambda p: outcomes[p["match_id"]]["home_score"] - outcomes[p["match_id"]]["away_score"]
actual_total = lambda p: outcomes[p["match_id"]]["home_score"] + outcomes[p["match_id"]]["away_score"]
score_errors = {
    "matches": len(scored),
    "margin_mae": mean(abs(p["simulated_margin"] - actual_margin(p)) for p in scored),
    "total_mae": mean(abs(p["simulated_total"] - actual_total(p)) for p in scored),
    "total_bias": mean(p["simulated_total"] - actual_total(p) for p in scored),
    "zero_margin_mae": mean(abs(actual_margin(p)) for p in scored),
}
buckets = []
for low in (0.0, 0.2, 0.4, 0.6, 0.8):
    group = [p for p in subset if low <= p["simulation_probability"] < low + 0.2 or (low == 0.8 and p["simulation_probability"] == 1)]
    if group:
        buckets.append({"range": f"{low:.1f}-{low + 0.2:.1f}", "matches": len(group),
                        "mean_probability": mean(p["simulation_probability"] for p in group),
                        "home_win_rate": mean(outcomes[p["match_id"]]["home_won"] for p in group)})
report = {"season": "2025-26", "matches": len(matches), "evaluated": len(subset),
          "evaluation_rule": "both teams have five earlier matches; same-day results excluded",
          "possession_games": len(by_match), "simulations_per_match": args.simulations,
          "parameters": {**params, "seed": 0, "selected_by_this_season": False},
          "metrics": metrics, "score_errors": score_errors, "calibration": buckets}
if args.freeze:
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    frozen = {**report, "frozen_at": datetime.now(timezone.utc).isoformat(),
              "sources_sha256": {"possessions": sha(args.possessions),
                                 "matches": sha(root / "prototypes/paper-home/public/data/men-2025-26-matches.json"),
                                 "possession_sim.py": sha(folder / "possession_sim.py"),
                                 "possession_counting": sha(root / "normalization/basketfi_possessions.py")},
              "predictions": [{key: p[key] for key in ("match_id", "date", "home", "away", "simulation_probability",
                               "home_win_probability", "margin_home_probability", "simulated_margin", "simulated_total")}
                              | {"home_won": outcomes[p["match_id"]]["home_won"]} for p in subset]}
    with (folder / f"results/possession-sim-{args.freeze}.json").open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(frozen, ensure_ascii=False, indent=2) + "\n")
(folder / "results/possession-sim-backtest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"metrics": {k: round(v["brier"], 4) for k, v in metrics.items()},
                  "correct": {k: f"{v['correct']}/{v['favorites']}" for k, v in metrics.items()},
                  "score_errors": {k: round(v, 2) for k, v in score_errors.items()}, "calibration": buckets}, indent=1))
