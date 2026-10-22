"""Valmistele yhden ottelun paikallinen kortti tallennetusta ennusteesta."""

from datetime import datetime
import json
from pathlib import Path
import shutil

from forecast_tracker import HELSINKI

folder = Path(__file__).resolve().parent
root = folder.parents[1]
latest = json.loads((folder / "results/men-latest-forecasts.json").read_text())
match_id = "1005937"
record = next((row for row in latest["forecasts"] if row["match_id"] == match_id), None)
history = [json.loads(line) for line in (folder / "history/men-forecasts-v1.jsonl").read_text().splitlines() if line]
original = next(row for row in history if row["match_id"] == match_id and row["evaluation_eligible"])
if record is None:
    record = next((entry["forecast"] for entry in latest["evaluated"] if entry["forecast"]["match_id"] == match_id), original)
lock = json.loads((folder / "model-lock-men-v1.json").read_text())
review_path = folder / "results/men-reviewed-results.json"
review = json.loads(review_path.read_text()) if review_path.exists() else {}
reviewed_evaluation = next((entry for entry in review.get("evaluated", [])
                           if entry["forecast"]["match_id"] == match_id
                           and entry["forecast"]["model_sha256"] == original["model_sha256"]), None)
teams = []
for side, logo in [("home", "salon-vilpas"), ("away", "ktp-basket")]:
    team_id = record[f"{side}_id"]
    games = []
    for game in record["evidence"]:
        if team_id not in [game["home_id"], game["away_id"]]:
            continue
        is_home = team_id == game["home_id"]
        scored = game["home_score"] if is_home else game["away_score"]
        conceded = game["away_score"] if is_home else game["home_score"]
        games.append({"match_id": game["match_id"], "date": game["kickoff"], "points_for": scored, "points_against": conceded})
    total = sum(game["points_for"] - game["points_against"] for game in games)
    teams.append({"name": record[side], "logo": logo, "games": len(games),
                  "margin_average": total / len(games) if games else None,
                  "adjusted_margin": total / (len(games) + lock["prior_games"]), "evidence": games})
payload = {"match_id": match_id, "kickoff": datetime.fromisoformat(record["kickoff"]).astimezone(HELSINKI).strftime("%d.%m.%Y · %H:%M"),
           "created_at": datetime.fromisoformat(record["created_at"]).astimezone(HELSINKI).strftime("%d.%m.%Y %H:%M"),
           "source_updated_at": datetime.fromisoformat(latest["source_updated_at"]).astimezone(HELSINKI).strftime("%d.%m.%Y %H:%M"),
           "model_version": record["model_version"], "probabilities": record["probabilities"],
           "original_probabilities": original["probabilities"], "teams": teams,
           "evaluation": reviewed_evaluation or next((entry for entry in latest["evaluated"] if entry["forecast"]["match_id"] == match_id), None),
           "prior_games": lock["prior_games"], "feature_divisor": lock["feature_divisor"]}
preview = folder / "preview"
assets = preview / "assets"
assets.mkdir(parents=True, exist_ok=True)
source_assets = root / "prototypes/paper-home/public"
for source, destination in [
    (source_assets / "assets/fdN99sWUv3gWqXxqqSBb.ttf", assets / "CalSans.ttf"),
    (source_assets / "assets/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf", assets / "Inter-Regular.ttf"),
    (source_assets / "assets/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf", assets / "Inter-Semibold.ttf"),
    (source_assets / "logos/salon-vilpas.png", assets / "salon-vilpas.png"),
    (source_assets / "logos/ktp-basket.png", assets / "ktp-basket.png"),
]:
    shutil.copy2(source, destination)
(preview / "card-data.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(preview / "index.html")
