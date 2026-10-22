"""Aja paikallinen koe ja kirjoita tarkasteltava yhteenveto, ei julkaise mitään."""

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from elo_backtest import evaluate, run_backtest

project_root = Path(__file__).resolve().parents[2]
source = project_root / "prototypes/paper-home/public/data/women-2025-26-matches.json"
source_bytes = source.read_bytes()
matches = json.loads(source_bytes)
result = run_backtest(matches, k=32)
predictions, outcomes = result["predictions"], result["outcomes"]
sixth = [prediction for prediction in predictions if prediction["sixth_for"]]
warm = [prediction for prediction in predictions if prediction["both_have_five"]]

output = Path(__file__).resolve().parent / "results"
output.mkdir(exist_ok=True)
result["metadata"] = {
    "source": str(source.relative_to(project_root)),
    "source_sha256": hashlib.sha256(source_bytes).hexdigest(),
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "k": 32, "initial_rating": 1500, "scale": 400,
    "same_day_results_excluded": True,
    "scope": "Retrospective experiment, not calibrated or published predictions",
}
(output / "women-2025-26-elo.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")

lines = [
    "# Ensimmäinen Elo-koe · Naisten Korisliiga 2025–26", "",
    "Paikallinen historiallinen koe. Ei tuotannon ennuste eikä validoitu voittotodennäköisyys.", "",
    "Kaikki joukkueet aloittavat luvusta 1500. K=32 ja asteikko 400 ovat ennalta valittuja",
    "harjoitusarvoja; niitä ei ole optimoitu tämän kauden tuloksiin. Mukana ei ole kotietua,",
    "poissaoloja, minuuttirajoituksia, piste-eroa tai viime kauden tietoa.", "",
    "Ottelut käsitellään aikajärjestyksessä. Jokaisen päivän arviot tallennetaan ennen",
    "sen päivän tulosten käsittelyä. Kohdeottelun tulos ei vaikuta sen omaan arvioon.", "",
    "## Joukkueiden kuudennet ottelut", "",
    "Joukkueella on viisi aiempaa ottelua; vastustajan otos voi olla eri kokoinen.",
    "Sama ottelu näkyy vain kerran. Prosentit esitetään yhden desimaalin tarkkuudella",
    "tämän kokeen vertailua varten, ei todisteena mallin tarkkuudesta.", "",
    "| Päivä | Koti – vieras | Aiemmat pelit K/V | Koti / vieras | Toteuma | Kuudes peli |",
    "|---|---|---:|---:|---|---|",
]
for prediction in sixth:
    outcome = outcomes[prediction["match_id"]]
    probability = prediction["home_win_probability"]
    date = datetime.fromisoformat(prediction["date"]).strftime("%d.%m.%Y")
    lines.append(
        f"| {date} | {prediction['home']} – {prediction['away']} | "
        f"{prediction['home_prior_games']}/{prediction['away_prior_games']} | "
        f"{100 * probability:.1f} % / {100 * (1-probability):.1f} % | "
        f"{outcome['home_score']}–{outcome['away_score']} | {', '.join(prediction['sixth_for'])} |"
    )

lines += ["", "## Arviointi", "", "Brier-arvo mittaa todennäköisyyden ja toteuman erotuksen neliötä.",
          "Pienempi on parempi; jatkuva 50–50-arvio saa arvon 0,250.", "",
          "| Otos | Pelejä | Elo Brier | 50–50 Brier | Aiempi kotivoitto-osuus Brier |",
          "|---|---:|---:|---:|---:|"]
for name, sample in [("Kuudennet", sixth), ("Molemmilla vähintään 5 aiempaa", warm), ("Koko aineisto, myös kylmä alku", predictions)]:
    scores = [evaluate(sample, outcomes, key) for key in ["home_win_probability", "flat_probability", "historical_home_probability"]]
    lines.append(f"| {name} | {len(sample)} | " + " | ".join(f"{score['brier']:.3f}" if score["brier"] is not None else "—" for score in scores) + " |")
score = evaluate(sixth, outcomes)
lines += ["", f"Kuudensissa peleissä suosikki voitti {score['correct']}/{score['favorites']} kertaa. "
          f"Tasavahvoja arvioita: {score['ties']}. Tasavahvasta arviosta ei nimetä suosikkia.", "",
          "## Mitä tästä ei voi päätellä", "",
          "- Kuudensien otteluiden pieni otos ei osoita mallin luotettavuutta.",
          "- Virheestä ei voi päätellä loukkaantumista, lepuutusta tai motivaatiota.",
          "- Koko kauden luvut ovat tässä kehitysaineiston tuloksia. Parannukset tarvitsevat myöhemmin erillisen testijakson.",
          "- Nykyinen historiallinen tiedosto voi sisältää jälkikäteen tehtyjä korjauksia; tiedon alkuperäistä saatavuushetkeä ei ole arkistoitu.",
          "- Malli ennustaa voittajaa, ei loppupisteitä. Tulos näkyy vain jälkikäteisessä arvioinnissa.", "",
          f"Lähde: `{result['metadata']['source']}` · SHA256 `{result['metadata']['source_sha256']}`", ""]
report = output / "first-elo-experiment.md"
report.write_text("\n".join(lines), encoding="utf-8")
print("\n".join(lines))
print(f"\nTallennettu: {report}")
