"""Vertaa ennalta valittuja historiapainoja. Älä valitse automaattisesti parasta.

Aja: python3 learning/forecasting/07_previous_season.py
2025–26 on kehitysaineisto, ei riippumaton testi tämän jälkeen valitulle mallille.
"""

from collections import Counter
from datetime import datetime
import hashlib
import json
from pathlib import Path
from zoneinfo import ZoneInfo

from elo_backtest import evaluate, run_backtest


def load_season(path):
    matches = json.loads(path.read_text(encoding="utf-8"))
    for match in matches:
        date = datetime.fromisoformat(match["date"])
        if date.tzinfo is None:
            # Vain tämän suomalaisen lähdeaineiston aikavyöhykkeetön paikallisaika.
            date = date.replace(tzinfo=ZoneInfo("Europe/Helsinki"))
        match["date"] = date.isoformat()
    return matches


root = Path(__file__).resolve().parents[2]
previous_source = root / "prototypes/paper-home/public/data/women-2024-25-matches.json"
current_source = root / "prototypes/paper-home/public/data/women-2025-26-matches.json"
previous_matches, current_matches = load_season(previous_source), load_season(current_source)
if max(datetime.fromisoformat(game["date"]) for game in previous_matches) >= min(
    datetime.fromisoformat(game["date"]) for game in current_matches
):
    raise ValueError("Kaudet menevät ajallisesti päällekkäin")

previous = run_backtest(previous_matches)
previous_names = {team["id"]: team["name"] for game in previous_matches for team in game["teams"]}
current_names = {team["id"]: team["name"] for game in current_matches for team in game["teams"]}
coverage = Counter(team["id"] for game in previous_matches for team in game["teams"])
for team_id in previous_names.keys() & current_names.keys():
    if previous_names[team_id] != current_names[team_id]:
        raise ValueError("Sama tunniste eri nimellä: tarkista kausien joukkueyhdistys")

experiments = []
lines = ["# Edellisen kauden paino · ensimmäinen vertailu", "",
         "Historiallinen kehityskoe. Ei tuotannon malli eikä parametrin lopullinen valinta.", "",
         "2024–25 aineiston ottelut muodostavat lähtöarvion. Uuden kauden lähtöluku:", "",
         "`1500 + kerroin * (edellisen aineiston päättävä Elo - 1500)`", "",
         "Kertoimet 0, 0,25, 0,5, 0,75 ja 1 valittiin ennen tulosten laskemista.",
         "Kaikissa K=32 ja asteikko 400. Kokoonpanomuutoksia ei vielä huomioida.",
         "Uusi tunnistamaton joukkue aloittaisi 1500:sta; lähtöluvut yhdistetään ID:llä.", "",
         f"Edellinen aineisto: {len(previous_matches)} ottelua, {len(previous_names)} joukkuetta.",
         "Tiedoston ei ole tässä varmistettu kattavan koko kilpailukautta tai pudotuspelejä.",
         "2024–25 aikavyöhykkeettömät ajat tulkittiin lähteen suomalaiseksi paikallisajaksi.", "",
         "## Lähtöarvioiden lähdeotos", "", "| Joukkue | Aiemman aineiston pelejä | Elo lopussa |",
         "|---|---:|---:|"]
for team_id, name in sorted(current_names.items(), key=lambda item: item[1]):
    rating = previous["final_ratings"].get(team_id)
    lines.append(f"| {name} | {coverage[team_id]} | {rating:.1f} |" if rating is not None else f"| {name} | 0 | Ei tietoa |")
lines += ["", "## Todennäköisyyksien vertailu", "",
          "Brier: pienempi on parempi. 50–50-arvion vertailuarvo on 0,250.",
          "Alkukausi = ottelut, joissa molemmilla on alle viisi aiempaa peliä.",
          "Ryhmärajat perustuvat ottelumääriin, eivät arvioihin, joten otokset ovat kaikille samat.", "",
          "| Kerroin | Alkukauden Brier | Kuudensien Brier | Loppuotoksen Brier | Koko aineiston Brier |",
          "|---:|---:|---:|---:|---:|"]
for carryover in [0, 0.25, 0.5, 0.75, 1]:
    starting = {
        team_id: 1500 + carryover * (previous["final_ratings"].get(team_id, 1500) - 1500)
        for team_id in current_names
    }
    experiment = run_backtest(current_matches, initial_ratings=starting)
    predictions, outcomes = experiment["predictions"], experiment["outcomes"]
    samples = {
        "early": [p for p in predictions if p["home_prior_games"] < 5 and p["away_prior_games"] < 5],
        "sixth": [p for p in predictions if p["sixth_for"]],
        "warm": [p for p in predictions if p["both_have_five"]],
        "all": predictions,
    }
    metrics = {key: evaluate(sample, outcomes) for key, sample in samples.items()}
    experiments.append({"carryover": carryover, "starting_ratings": starting, "metrics": metrics, **experiment})
    lines.append(f"| {carryover:g} | " + " | ".join(f"{metrics[key]['brier']:.3f}" for key in samples) + " |")

counts = experiments[0]["metrics"]
lines += ["", "Ottelumäärät: " + ", ".join(f"{key}={metric['matches']}" for key, metric in counts.items()) + ".", "",
          "## Tulkinnan rajat", "",
          "- Koko kauden keskiarvo ei saa peittää alkukauden mahdollista hyötyä tai haittaa.",
          "- Mallia ei valita seitsemän kuudennen pelin perusteella. Ryhmät sisältävät osittain samoja otteluita.",
          "- Edellisen kauden vahvuuden jatkuvuus on oletus; pelaajasiirrot voivat rikkoa sen.",
          "- Pienempi Brier tässä aineistossa ei osoita toimivuutta seuraavalla kaudella.",
          "- Jos kerroin valitaan tästä vertailusta, 2025–26 on sen kehitysaineisto. Seuraava testi pitää pitää erillään.",
          "- Saman päivän tulokset eivät vaikuta toisiinsa; historiatiedon alkuperäisiä julkaisuaikoja ei tunneta.", ""]
output = Path(__file__).resolve().parent / "results"
output.mkdir(exist_ok=True)
metadata = {"sources": {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
                        for path in [previous_source, current_source]}, "parameters_tuned": False}
(output / "previous-season-comparison.json").write_text(json.dumps({"metadata": metadata, "experiments": experiments}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(output / "previous-season-comparison.md").write_text("\n".join(lines), encoding="utf-8")
print("\n".join(lines))
