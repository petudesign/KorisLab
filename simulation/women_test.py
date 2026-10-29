"""Locked walk-forward test of the women's player simulator on 2025–26. (KOR-15)

python3 -m simulation.women_test

Same rule as the men's test: every game is predicted from earlier days only, 2024–25 counts with weight
0.5 and the priors are the locked v1 values (never tuned on women's data). Comparison models come from the
existing women's experiments: Elo k=32, the locked women-margin-v1 model, the home-win rate and 50/50.
Kickoff dates come from the site's game files, the same source Sim Studio uses. Writes
results/player-sim-women-v1.json once and refuses to overwrite it.
"""
from datetime import datetime
import json
from pathlib import Path
from statistics import mean
import sys
from zoneinfo import ZoneInfo

from simulation.evaluate import walk_forward
from simulation.history import join_season
from simulation.player_sim import PRIORS
from simulation.refresh import read_history, site_dates

FOLDER = Path("learning/forecasting")
sys.path.insert(0, str(FOLDER))
from comparison_models import margin_features, sigmoid  # noqa: E402
from elo_backtest import checked_matches, run_backtest  # noqa: E402

RESULTS = FOLDER / "results"
SITE = Path("prototypes/paper-home/public/data/women-2025-26-matches.json")
SIMULATIONS = 400
MODELS = {"player_simulation": "player_simulation", "elo_k32": "home_win_probability", "margin_home_locked": "margin_home_probability",
          "home_rate": "historical_home_probability", "flat": "flat_probability"}


def site_matches():
    matches = json.loads(SITE.read_text(encoding="utf-8"))
    for match in matches:
        date = datetime.fromisoformat(match["date"])
        if date.tzinfo is None:
            match["date"] = date.replace(tzinfo=ZoneInfo("Europe/Helsinki")).isoformat()
    return checked_matches(matches)


def records(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))["matches"]


def calibration(rows):
    groups = []
    for low in (0.0, 0.2, 0.4, 0.6, 0.8):
        group = [r for r in rows if low <= r["player_simulation"] < low + 0.2 or (low == 0.8 and r["player_simulation"] == 1)]
        if group:
            groups.append({"range": f"{low:.1f}-{low + 0.2:.1f}", "matches": len(group),
                           "mean_probability": round(mean(r["player_simulation"] for r in group), 3),
                           "home_win_rate": round(mean(r["home_won"] for r in group), 3)})
    return groups


def main():
    out = RESULTS / "player-sim-women-v1.json"
    if out.exists():
        raise SystemExit(f"{out.name} is already locked.")
    history = join_season(records("data/normalized/season_2024_2025.json"), read_history("naisten-korisliiga", "2024-25"), 0.5, site_dates("women", "2024-25"))
    target = join_season(records("data/normalized/season_verified.json"), read_history("naisten-korisliiga", "2025-26"), 1.0, site_dates("women", "2025-26"))
    simulated = walk_forward(history, target, SIMULATIONS)

    matches = site_matches()
    elo = run_backtest(matches)
    margin_lock = json.loads((FOLDER / "model-lock-v1.json").read_text(encoding="utf-8"))["models"]["margin_home"]
    margin = {row["match_id"]: row["margin_feature"] for row in margin_features(matches)[0]}
    scores = {g["match_id"]: g for g in target}
    rows = []
    for p in elo["predictions"]:
        sim, game = simulated.get(p["match_id"]), scores.get(p["match_id"])
        if not p["both_have_five"] or sim is None or game is None:
            continue
        score = {t["source_id"]: t["score"] for t in game["record"]["teams"]}
        away = next(t for t in score if t != game["home"])
        rows.append({**p, "player_simulation": sim["home_win_probability"], "home_won": elo["outcomes"][p["match_id"]]["home_won"],
                     "margin_home_probability": sigmoid(margin_lock["bias"] + margin_lock["slope"] * margin[p["match_id"]]),
                     "mean_margin": sim["mean_margin"], "margin": score[game["home"]] - score[away],
                     "mean_total": sim["mean_total"], "total": sum(score.values())})
    brier = {name: round(mean((r[key] - r["home_won"]) ** 2 for r in rows), 4) for name, key in MODELS.items()}
    report = {"season": "2025-26", "league": "women", "matches": len(rows), "simulations_per_match": SIMULATIONS,
              "evaluation_rule": "both teams have five earlier games; same-day results excluded",
              "history": "2024-25 weight 0.5, earlier 2025-26 days weight 1", "priors": PRIORS, "metrics_brier": brier,
              "favorites_correct": sum((r["player_simulation"] > 0.5) == bool(r["home_won"]) for r in rows if r["player_simulation"] != 0.5),
              "margin_mae": round(mean(abs(r["mean_margin"] - r["margin"]) for r in rows), 2),
              "total_bias": round(mean(r["mean_total"] - r["total"] for r in rows), 2),
              "calibration": calibration(rows),
              "predictions": [{k: r[k] for k in ("match_id", "player_simulation", "home_win_probability", "margin_home_probability", "home_won")} for r in rows]}
    with out.open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "predictions"}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
