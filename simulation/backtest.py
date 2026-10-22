"""Walk-forward test of the player simulator on 2025–26, against the frozen v2 comparison.

python3 -m simulation.backtest --possessions-2024 P24.json --possessions-2025 P25.json

Every prediction uses only games from earlier days. Priors were chosen before the
test and are not tuned on 2025–26. The evaluated matches and the other models'
probabilities come from `learning/forecasting/results/possession-sim-v2.json`.
"""
import argparse
from collections import defaultdict
import json
from pathlib import Path
from statistics import mean

from simulation.history import load_season
from simulation.player_sim import PRIORS, GameSimulator, PlayerModel

RESULTS = Path("learning/forecasting/results")


def brier(rows, key):
    return mean((row[key] - row["home_won"]) ** 2 for row in rows)


def run(history, target, simulations):
    by_day = defaultdict(list)
    for game in target:
        by_day[game["date"]].append(game)
    earlier = list(history)
    output = {}
    for day in sorted(by_day):
        model = PlayerModel(earlier) if earlier else None
        for game in by_day[day]:
            record = game["record"]
            away = next(t["source_id"] for t in record["teams"] if t["source_id"] != game["home"])
            try:
                simulator = GameSimulator(model, game["home"], away)
            except (ValueError, AttributeError):
                continue
            results = [simulator.play(seed) for seed in range(simulations)]
            points = defaultdict(float)
            for result in results:
                for pid, values in result["stats"].items():
                    points[pid] += values.get("points", 0) / simulations
            output[game["match_id"]] = {
                "home_win_probability": mean(r["score"][game["home"]] > r["score"][away] for r in results),
                "mean_margin": mean(r["score"][game["home"]] - r["score"][away] for r in results),
                "mean_total": mean(sum(r["score"].values()) for r in results),
                "player_points": dict(points)}
        earlier.extend(by_day[day])
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--possessions-2024", type=Path, required=True)
    parser.add_argument("--possessions-2025", type=Path, required=True)
    parser.add_argument("--simulations", type=int, default=400)
    parser.add_argument("--freeze", help="Write a never-overwritten copy as results/player-sim-NAME.json")
    args = parser.parse_args()
    history = load_season("data/normalized/season_korisliiga_2024_2025.json", args.possessions_2024, 0.5)
    target = load_season("data/normalized/season_korisliiga_2025_2026.json", args.possessions_2025, 1.0)
    simulated = run(history, target, args.simulations)

    frozen = json.loads((RESULTS / "possession-sim-v2.json").read_text(encoding="utf-8"))
    rows = [{**p, "player_simulation": simulated[p["match_id"]]["home_win_probability"]}
            for p in frozen["predictions"] if p["match_id"] in simulated]
    metrics = {name: round(brier(rows, key), 4) for name, key in (
        ("player_simulation", "player_simulation"), ("possession_simulation_v2", "simulation_probability"),
        ("elo_k32", "home_win_probability"), ("margin_home_locked", "margin_home_probability"))}
    correct = {"player_simulation": sum((r["player_simulation"] > 0.5) == bool(r["home_won"]) for r in rows if r["player_simulation"] != 0.5)}

    records = {g["match_id"]: g for g in target}
    margin_errors, total_errors, point_pairs = [], [], []
    for row in rows:
        sim, record = simulated[row["match_id"]], records[row["match_id"]]["record"]
        score = {t["source_id"]: t["score"] for t in record["teams"]}
        home = records[row["match_id"]]["home"]
        away = next(t for t in score if t != home)
        margin_errors.append(abs(sim["mean_margin"] - (score[home] - score[away])))
        total_errors.append(sim["mean_total"] - sum(score.values()))
        for team in record["teams"]:
            for player in team["players"]:
                if player.get("participated") and player["source_player_id"] in sim["player_points"]:
                    point_pairs.append((sim["player_points"][player["source_player_id"]], player["stats"].get("points") or 0))
    n = len(point_pairs)
    mx, my = mean(p[0] for p in point_pairs), mean(p[1] for p in point_pairs)
    correlation = (sum((a - mx) * (b - my) for a, b in point_pairs)
                   / (sum((a - mx) ** 2 for a, _ in point_pairs) * sum((b - my) ** 2 for _, b in point_pairs)) ** 0.5)
    calibration = []
    for low in (0.0, 0.2, 0.4, 0.6, 0.8):
        group = [r for r in rows if low <= r["player_simulation"] < low + 0.2 or (low == 0.8 and r["player_simulation"] == 1)]
        if group:
            calibration.append({"range": f"{low:.1f}-{low + 0.2:.1f}", "matches": len(group),
                                "mean_probability": round(mean(r["player_simulation"] for r in group), 3),
                                "home_win_rate": round(mean(r["home_won"] for r in group), 3)})
    report = {"season": "2025-26", "matches": len(rows), "simulations_per_match": args.simulations,
              "history": "2024-25 weight 0.5, earlier 2025-26 days weight 1", "priors": PRIORS,
              "metrics_brier": metrics, "favorites_correct": correct,
              "margin_mae": round(mean(margin_errors), 2), "total_bias": round(mean(total_errors), 2),
              "player_points": {"players": n, "mae": round(mean(abs(a - b) for a, b in point_pairs), 2),
                                "correlation": round(correlation, 3)},
              "calibration": calibration}
    print(json.dumps(report, ensure_ascii=False, indent=1))
    (RESULTS / "player-sim-backtest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.freeze:
        payload = {**report, "predictions": [{"match_id": r["match_id"], "player_simulation": r["player_simulation"],
                                              "home_won": r["home_won"]} for r in rows]}
        with (RESULTS / f"player-sim-{args.freeze}.json").open("x", encoding="utf-8") as stream:
            stream.write(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
