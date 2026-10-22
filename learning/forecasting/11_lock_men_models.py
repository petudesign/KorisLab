"""Sovita miesten omat lähtötasot 2024–25 aineistolla ja lukitse kerran.

Aja: python3 learning/forecasting/11_lock_men_models.py
Tämä ei käytä naisten parametreja eikä sovita niitä tämän kauden tuloksiin.
"""

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from zoneinfo import ZoneInfo

from comparison_models import fit_logistic, margin_features, sigmoid
from elo_backtest import evaluate

folder = Path(__file__).resolve().parent
root = folder.parents[1]
lock_path = folder / "model-lock-men-v1.json"
if lock_path.exists():
    raise SystemExit("Miesten v1 on jo lukittu. Seurantaa jatketaan ilman uudelleensovitusta.")


def load(year):
    source = root / f"prototypes/paper-home/public/data/men-{year}-matches.json"
    games = json.loads(source.read_text(encoding="utf-8"))
    for game in games:
        date = datetime.fromisoformat(game["date"])
        if date.tzinfo is None:
            date = date.replace(tzinfo=ZoneInfo("Europe/Helsinki"))
        game["date"] = date.isoformat()
    return source, games


training_source, training = load("2024-25")
validation_source, validation = load("2025-26")
if max(datetime.fromisoformat(g["date"]) for g in training) >= min(datetime.fromisoformat(g["date"]) for g in validation):
    raise ValueError("Sovitus- ja vertailukaudet menevät päällekkäin")
features, outcomes = margin_features(training)
samples = [(row["margin_feature"], outcomes[row["match_id"]]["home_won"]) for row in features if row["both_have_five"]]
home_fit = fit_logistic(samples)
mirrored = samples + [(-value, 1-actual) for value, actual in samples]
neutral_fit = fit_logistic(mirrored, sample_weight=0.5)
neutral_fit["bias"] = 0.0
lock = {
    "version": "men-margin-v1", "league": "men", "locked_at": datetime.now(timezone.utc).isoformat(),
    "training_season": "2024-25", "training_source_sha256": hashlib.sha256(training_source.read_bytes()).hexdigest(),
    "training_matches": len(samples), "prior_games": 5, "feature_divisor": 10,
    "evaluation_rule": "first archived forecast within seven days before actual kickoff; same teams and kickoff required",
    "models": {"margin": neutral_fit, "margin_home": home_fit},
    "limitations": ["Missing one 2024-25 match", "No roster, injury, rest or opponent-strength adjustment", "Not calibrated on prospective matches"],
}
# Varmista laskentapolku aiemmalla vertailukaudella; älä valitse parametreja sen perusteella.
validation_features, validation_outcomes = margin_features(validation)
metrics = {}
for name, fit in lock["models"].items():
    predictions = [{"match_id": row["match_id"], "home_win_probability": sigmoid(fit["bias"] + fit["slope"] * row["margin_feature"])}
                   for row in validation_features]
    metrics[name] = evaluate(predictions, validation_outcomes)
report = {
    "training_season": "2024-25", "training_rows": len(training), "training_samples": len(samples),
    "validation_season": "2025-26", "validation_rows": len(validation), "metrics": metrics,
    "validation_source_sha256": hashlib.sha256(validation_source.read_bytes()).hexdigest(),
    "parameters_selected_by_validation": False,
}
with lock_path.open("x", encoding="utf-8") as stream:
    stream.write(json.dumps(lock, ensure_ascii=False, indent=2) + "\n")
(folder / "results/men-model-validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Miesten mallit lukittu: {len(samples)} sovitusottelua 2024–25 aineistosta.")
print(json.dumps(metrics, ensure_ascii=False, indent=2))
