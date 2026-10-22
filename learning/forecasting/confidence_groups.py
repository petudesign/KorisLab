"""Ryhmät ovat tarkastelua varten valittuja rajoja, eivät validoituja luokkia."""

from elo_backtest import evaluate


def summarize_groups(predictions, outcomes):
    groups = [
        ("Lähes tasavahva: yli 50 %, alle 55 %", 0.5, 0.55),
        ("Kohtalainen suosikki: 55–alle 65 %", 0.55, 0.65),
        ("Vahva suosikki: vähintään 65 %", 0.65, 1.01),
    ]
    summaries = []
    for label, low, high in groups:
        selected = []
        probabilities = []
        for prediction in predictions:
            home_probability = prediction["home_win_probability"]
            favorite_probability = max(home_probability, 1 - home_probability)
            if home_probability != 0.5 and low <= favorite_probability < high:
                selected.append(prediction)
                probabilities.append(favorite_probability)
        metrics = evaluate(selected, outcomes)
        summaries.append({
            "label": label, "matches": len(selected),
            "mean_probability": sum(probabilities) / len(selected) if selected else None,
            "wins": metrics["correct"],
            "win_rate": metrics["correct"] / len(selected) if selected else None,
            "brier": metrics["brier"],
            "match_ids": [prediction["match_id"] for prediction in selected],
        })
    return summaries
