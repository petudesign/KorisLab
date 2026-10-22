"""Sovita vertailut vain 2024–25 aineistolla ja arvioi 2025–26 aineistolla."""

from datetime import datetime
import hashlib
import json
from pathlib import Path
from zoneinfo import ZoneInfo

from comparison_models import elo_bias_samples, fit_logistic, margin_features, sigmoid
from elo_backtest import evaluate, run_backtest


def load(path):
    games = json.loads(path.read_text(encoding="utf-8"))
    for game in games:
        date = datetime.fromisoformat(game["date"])
        if date.tzinfo is None:
            date = date.replace(tzinfo=ZoneInfo("Europe/Helsinki"))
        game["date"] = date.isoformat()
    return games


root = Path(__file__).resolve().parents[2]
data = root / "prototypes/paper-home/public/data"
previous_path, current_path = data / "women-2024-25-matches.json", data / "women-2025-26-matches.json"
previous, current = load(previous_path), load(current_path)
if max(datetime.fromisoformat(g["date"]) for g in previous) >= min(datetime.fromisoformat(g["date"]) for g in current):
    raise ValueError("Sovitus- ja vertailukaudet menevät päällekkäin")
seasons = json.loads((root / "prototypes/paper-home/source/seasons.json").read_text())

training_elo = run_backtest(previous)
home_fit = fit_logistic(elo_bias_samples(training_elo["predictions"], training_elo["outcomes"]), fit_slope=False)
training_margin, training_outcomes = margin_features(previous)
training_samples = [(row["margin_feature"], training_outcomes[row["match_id"]]["home_won"])
                    for row in training_margin if row["both_have_five"]]
margin_fit = fit_logistic(training_samples)

# Kotipaikaton piste-eromalli: peilataan jokainen harjoitusottelu.
# Tämä pakottaa biasin nollaan, joten kotijoukkueen etua ei oleteta.
mirrored = training_samples + [(-value, 1-actual) for value, actual in training_samples]
margin_neutral_fit = fit_logistic(mirrored, sample_weight=0.5)
baseline = run_backtest(current)
home_elo = run_backtest(current, home_logodds=home_fit["bias"])
current_margin, _ = margin_features(current)
margin_map = {row["match_id"]: row for row in current_margin}
models = [("Elo ilman kotietua", baseline["predictions"]), ("Elo + aiemmasta kaudesta sovitettu kotipaikkakorjaus", home_elo["predictions"])]
for label, parameters in [("Piste-ero ilman kotietua", margin_neutral_fit), ("Piste-ero + kotipaikkakorjaus", margin_fit)]:
    predictions = []
    for prediction in baseline["predictions"]:
        value = margin_map[prediction["match_id"]]["margin_feature"]
        probability = sigmoid(parameters["bias"] + parameters["slope"] * value)
        predictions.append({**prediction, "home_win_probability": probability})
    models.append((label, predictions))

lines = ["# Aineiston kattavuus ja mallivertailu", "",
         "Paikallinen kehityskoe: parametrit sovitetaan vain 2024–25 otteluihin.",
         "2025–26 arvioidaan aikajärjestyksessä. Tätä kautta on jo tutkittu aiemmissa kokeissa,",
         "joten se ei ole koskematon lopullinen testikausi. Ei julkaistuja ennusteita.", "",
         "## Kattavuus", "", "| Kausi | Lähdekoosteen pelatut | Haetut / tässä käytetyt | Haun epäonnistumiset |",
         "|---|---:|---:|---:|"]
for year, games in [("2024-25", previous), ("2025-26", current)]:
    summary = seasons["women"][year]["summary"]
    lines.append(f"| {year} | {summary['available_played_games']} | {len(games)} | {summary['failed_games']} |")
lines += ["", "2024–25 otoksesta puuttuu yksi lähdekoosteessa mainittu ottelu.",
          "Forssan Alulla ja Vimpelin Vedolla on 25 ottelua, muilla 26; tämä ei yksin varmista puuttuvan pelin tunnistetta.",
          "2025–26 kaikilla on 24 ottelua, ja tiedoston 108 peliä täsmää lähdekoosteeseen.",
          "Tämä on sisäinen kattavuustarkistus, ei riippumaton koko kilpailukauden varmennus.",
          "Pudotuspelit ovat erillisissä aineistoissa eivätkä mukana tässä runkosarjakokeessa.", "",
          "## Vertailu · Brier, pienempi parempi", "",
          "Kaikki mallit arvioidaan samoilla otteluilla. Alkukausi: molemmilla alle 5 aiempaa peliä.",
          "Loppuotos: molemmilla vähintään 5. Väliin jäävät ottelut sisältyvät koko aineistoon.", "",
          "| Malli | Alkukausi (21) | Kuudennet (7) | Loppuotos (84) | Kaikki (108) |",
          "|---|---:|---:|---:|---:|"]
saved = []
for label, predictions in models:
    samples = [[p for p in predictions if p["home_prior_games"] < 5 and p["away_prior_games"] < 5],
               [p for p in predictions if p["sixth_for"]],
               [p for p in predictions if p["both_have_five"]], predictions]
    metrics = [evaluate(sample, baseline["outcomes"]) for sample in samples]
    lines.append("| " + label + " | " + " | ".join(f"{metric['brier']:.3f}" for metric in metrics) + " |")
    saved.append({"model": label, "metrics": metrics, "predictions": predictions})
lines += ["| Jatkuva 50–50 | 0.250 | 0.250 | 0.250 | 0.250 |", "",
          "## Mitä malliin lisättiin", "",
          "- Elo-kotipaikkakorjaus on aiemman kauden ennen ottelua laskettujen Elo-arvioiden log-odds-siirtymä.",
          "  Joukkueen vahvuusarvio päivittyy korjatun odotuksen mukaan. Korjaus ei ole todistettu kotiedun kausaalivaikutus.",
          "- Piste-eromalli käyttää ennen päivää kertynyttä tehtyjen ja päästettyjen pisteiden keskiarvoeroa.",
          "  Pientä otosta hillitsee viiden nollamarginaalisen lähtöpelin paino; skaalauksen jakaja on 10.",
          "  Logistinen muunnos sovitetaan aiempaan kauteen L2-painolla 1, ei arviointikauteen.",
          "- Piste-ero ei huomioi vastustajien vahvuutta, pelitempoa, poissaoloja tai kokoonpanon jatkuvuutta.",
          "- Malli ennustaa edelleen vain voittajaa, ei loppupisteitä tai piste-erojakaumaa.", "",
          "## Sovitetut arvot ja rajat", "",
          f"Harjoitusotteluita, molemmilla vähintään viisi aiempaa: {len(training_samples)}.",
          f"Elo-korjauksen bias: {home_fit['bias']:.4f}; tasavahvojen kotivoittoarvio: {sigmoid(home_fit['bias']):.1%}.",
          f"Piste-ero ilman kotietua: slope={margin_neutral_fit['slope']:.4f}, bias={margin_neutral_fit['bias']:.4f}.",
          f"Piste-ero + kotipaikka: slope={margin_fit['slope']:.4f}, bias={margin_fit['bias']:.4f}.", "",
          "Sovitus käyttää puutteellista aiempaa otosta. Erojen epävarmuutta ei ole vielä arvioitu,",
          "ja seuraavaan kauteen yleistyminen tarvitsee erillisen testin. Älä valitse tuotantomallia automaattisesti.", ""]
output = Path(__file__).resolve().parent / "results"
plain = ["## Mitä käytännössä tapahtui?", "",
         "Jokainen malli antoi ennen ottelua koti- ja vierasjoukkueen voittoarvion.",
         "Suuremman arvion saanut joukkue on mallin suosikki. Sitten katsottiin, voittiko se oikeasti.", "",
         "| Malli | Suosikki voitti | Suosikki hävisi | Ei suosikkia (50–50) |",
         "|---|---:|---:|---:|"]
for model in saved:
    metric = model["metrics"][-1]
    plain.append(f"| {model['model']} | {metric['correct']} | {metric['favorites'] - metric['correct']} | {metric['ties']} |")
plain += ["", "Jokaisen rivin luvut summautuvat 108 otteluun. Tasavahva arvio ei nimeä voittajaa,",
          "joten sitä ei merkitä oikeaksi tai vääräksi. Mallit eivät nimeä suosikkia täsmälleen samoihin peleihin.", "",
          "**Brier ei ole osumaprosentti eikä virheprosentti.** 0,194 ei tarkoita 19,4 % virheitä tai 80,6 % oikeita.",
          "Se arvioi, miten hyvin ennusteen varmuus sopii tuloksiin: 90 % suosikin tappio on suurempi virhe kuin 52 % suosikin tappio.",
          "Siksi malli voi nimetä voittajan oikein useammin, mutta antaa huonompia prosenttiarvioita.", "",
          "Piste-ero + kotipaikka nimesi oikean suosikin 77 kertaa, mutta kotipaikattoman mallin",
          "todennäköisyysarviot saivat pienemmän Brier-virheen. Tavoitteena ei siis ole vain voittajan arvaaminen",
          "vaan myös rehellinen arvio siitä, kuinka epävarma ottelu on. Tämä on edelleen yhden kauden kehityskoe.", ""]
lines[2:2] = plain
(output / "model-comparison.md").write_text("\n".join(lines), encoding="utf-8")
(output / "model-comparison.json").write_text(json.dumps({
    "sources": {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest() for path in [previous_path, current_path]},
    "home_fit": home_fit, "margin_fit": margin_fit, "margin_neutral_fit": margin_neutral_fit,
    "training_samples": len(training_samples), "models": saved,
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("\n".join(lines))
