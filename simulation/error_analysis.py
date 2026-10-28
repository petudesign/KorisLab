"""Where does the player simulator lose to the locked margin model on 2025–26? (KOR-10)

python3 -m simulation.error_analysis --possessions-2024 P24.json --possessions-2025 P25.json

Reruns the locked player-sim-v1 walk-forward (identical probabilities to the frozen file) to keep
each game's margin distribution, then compares game by game with the frozen margin model and Elo.
Roster continuity is descriptive: it uses full-season minutes, so it explains, it does not predict.
"""
import argparse
from collections import defaultdict
import json
from pathlib import Path
from statistics import mean, pstdev

from simulation.evaluate import walk_forward
from simulation.history import load_season

RESULTS = Path("learning/forecasting/results")
MODELS = (("player_sim", "player_simulation"), ("margin_model", "margin_home_probability"), ("elo", "home_win_probability"))


def brier(rows, key):
    return round(mean((r[key] - r["home_won"]) ** 2 for r in rows), 4) if rows else None


def decomposition(rows, key):
    """Murphy: Brier = reliability - resolution + uncertainty. Lower reliability and higher resolution are better."""
    base = mean(r["home_won"] for r in rows)
    bins = defaultdict(list)
    for r in rows:
        bins[min(int(r[key] * 10), 9)].append(r)
    n = len(rows)
    reliability = sum(len(g) * (mean(r[key] for r in g) - mean(r["home_won"] for r in g)) ** 2 for g in bins.values()) / n
    resolution = sum(len(g) * (mean(r["home_won"] for r in g) - base) ** 2 for g in bins.values()) / n
    return {"reliability": round(reliability, 4), "resolution": round(resolution, 4), "uncertainty": round(base * (1 - base), 4),
            "sharpness": round(mean(abs(r[key] - 0.5) for r in rows), 3)}


def compare(rows):
    return {"games": len(rows), **{name: brier(rows, key) for name, key in MODELS}}


def continuity(previous, current):
    """Share of each team's season minutes played by players who were on the same team the season before."""
    before = {(t["source_id"], p["source_player_id"]) for r in previous for t in r["teams"] for p in t["players"] if (p.get("minutes") or 0) > 0}
    total, kept = defaultdict(float), defaultdict(float)
    for r in current:
        for t in r["teams"]:
            for p in t["players"]:
                minutes = p.get("minutes") or 0
                total[t["source_id"]] += minutes
                if (t["source_id"], p["source_player_id"]) in before:
                    kept[t["source_id"]] += minutes
    return {team: kept[team] / total[team] for team in total if total[team]}


def analyse(simulated, frozen, target, previous_records):
    games = {g["match_id"]: g for g in target}
    rows = []
    for p in frozen:
        sim, game = simulated.get(p["match_id"]), games.get(p["match_id"])
        if sim is None or game is None:
            continue
        score = {t["source_id"]: t["score"] for t in game["record"]["teams"]}
        away = next(t for t in score if t != game["home"])
        rows.append({**p, "player_simulation": sim["home_win_probability"], "home_id": game["home"], "away_id": away,
                     "day": game["date"], "margin": score[game["home"]] - score[away], **{k: sim[k] for k in ("mean_margin", "margin_sd", "margin_p10", "margin_p90", "mean_total")},
                     "total": sum(score.values())})
    rows.sort(key=lambda r: r["day"])
    report = {"overall": compare(rows), "decomposition": {name: decomposition(rows, key) for name, key in MODELS}}

    # Disagreement: the two models favour different teams.
    split = [r for r in rows if (r["player_simulation"] - 0.5) * (r["margin_home_probability"] - 0.5) < 0]
    report["disagreements"] = {"games": len(split), "player_sim_right": sum((r["player_simulation"] > 0.5) == bool(r["home_won"]) for r in split),
                               "margin_model_right": sum((r["margin_home_probability"] > 0.5) == bool(r["home_won"]) for r in split)}
    gap = [r for r in rows if abs(r["player_simulation"] - r["margin_home_probability"]) >= 0.1]
    report["large_gaps"] = {**compare(gap), "player_sim_more_confident": sum(abs(r["player_simulation"] - 0.5) > abs(r["margin_home_probability"] - 0.5) for r in gap)}

    # Season phase: four equal blocks in date order.
    quarter = len(rows) // 4
    report["by_phase"] = [{"block": i + 1, "from": block[0]["day"], "to": block[-1]["day"], **compare(block)}
                          for i, block in enumerate([rows[:quarter], rows[quarter:2 * quarter], rows[2 * quarter:3 * quarter], rows[3 * quarter:]])]

    # Teams: every game counts for both teams.
    names = {t["source_id"]: t["name"] for g in target for t in g["record"]["teams"]}
    by_team = defaultdict(list)
    for r in rows:
        by_team[r["home_id"]].append(r)
        by_team[r["away_id"]].append(r)
    report["by_team"] = sorted(({"team": names.get(team, team), **compare(group), "gap": round(brier(group, "player_simulation") - brier(group, "margin_home_probability"), 4)}
                                for team, group in by_team.items()), key=lambda row: -row["gap"])

    # Roster continuity: the lower of the two teams decides the group.
    kept = continuity(previous_records, [g["record"] for g in target])
    for r in rows:
        r["continuity"] = min(kept.get(r["home_id"], 0), kept.get(r["away_id"], 0))
    ordered = sorted(rows, key=lambda r: r["continuity"])
    half = len(ordered) // 2
    report["by_continuity"] = {"teams": {names.get(t, t): round(v, 2) for t, v in sorted(kept.items(), key=lambda item: item[1])},
                               "low": {**compare(ordered[:half]), "max_continuity": round(ordered[half - 1]["continuity"], 2)},
                               "high": {**compare(ordered[half:]), "min_continuity": round(ordered[half]["continuity"], 2)},
                               "low_first_half_of_season": compare([r for r in ordered[:half] if r["day"] <= rows[len(rows) // 2]["day"]])}

    # Margin distribution: is the simulated spread the right width?
    z = [(r["margin"] - r["mean_margin"]) / r["margin_sd"] for r in rows if r["margin_sd"]]
    report["margin"] = {"mae": round(mean(abs(r["margin"] - r["mean_margin"]) for r in rows), 2),
                        "mean_simulated_sd": round(mean(r["margin_sd"] for r in rows), 2),
                        "actual_error_sd": round(pstdev([r["margin"] - r["mean_margin"] for r in rows]), 2),
                        "z_sd": round(pstdev(z), 3), "inside_p10_p90": round(mean(r["margin_p10"] <= r["margin"] <= r["margin_p90"] for r in rows), 3),
                        "mean_bias_home": round(mean(r["margin"] - r["mean_margin"] for r in rows), 2),
                        "spread_of_predicted_margins": round(pstdev([r["mean_margin"] for r in rows]), 2),
                        "total_bias": round(mean(r["mean_total"] - r["total"] for r in rows), 2)}
    report["games"] = [{k: r[k] for k in ("match_id", "day", "player_simulation", "margin_home_probability", "home_win_probability", "home_won", "mean_margin", "margin_sd", "margin", "continuity")} for r in rows]
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--possessions-2024", type=Path, required=True)
    parser.add_argument("--possessions-2025", type=Path, required=True)
    args = parser.parse_args()
    history = load_season("data/normalized/season_korisliiga_2024_2025.json", args.possessions_2024, 0.5)
    target = load_season("data/normalized/season_korisliiga_2025_2026.json", args.possessions_2025, 1.0)
    simulated = walk_forward(history, target, 400)
    frozen = json.loads((RESULTS / "possession-sim-v2.json").read_text(encoding="utf-8"))["predictions"]
    locked = {p["match_id"] for p in json.loads((RESULTS / "player-sim-v1.json").read_text(encoding="utf-8"))["predictions"]}
    previous = json.loads(Path("data/normalized/season_korisliiga_2024_2025.json").read_text(encoding="utf-8"))["matches"]
    report = analyse(simulated, [p for p in frozen if p["match_id"] in locked], target, previous)
    (RESULTS / "player-sim-v1-error-analysis.json").write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "games"}, ensure_ascii=False, indent=1))
