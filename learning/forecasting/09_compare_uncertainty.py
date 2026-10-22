"""Erottele voittajaosumat, prosenttien laatu ja mallien eron epävarmuus."""

import json
from pathlib import Path

from elo_backtest import evaluate
from model_uncertainty import bootstrap_difference

output = Path(__file__).resolve().parent / "results"
comparison = json.loads((output / "model-comparison.json").read_text())
experiment = json.loads((output / "women-2025-26-elo.json").read_text())
source_path = experiment["metadata"]["source"]
if comparison["sources"][source_path] != experiment["metadata"]["source_sha256"]:
    raise ValueError("Raporttien lähdeaineistot eroavat; aja kokeet uudelleen")
models, outcomes = comparison["models"], experiment["outcomes"]
neutral, home = models[2], models[3]
common_ids = {p["match_id"] for p in neutral["predictions"] if p["home_win_probability"] != 0.5}
neutral_common = [p for p in neutral["predictions"] if p["match_id"] in common_ids]
home_common = [p for p in home["predictions"] if p["match_id"] in common_ids]
home_extra = [p for p in home["predictions"] if p["match_id"] not in common_ids]
a = evaluate(neutral_common, outcomes)
b = evaluate(home_common, outcomes)
extra = evaluate(home_extra, outcomes)
point_vs_elo = bootstrap_difference(models[0]["predictions"], neutral["predictions"], outcomes)
home_vs_neutral = bootstrap_difference(neutral["predictions"], home["predictions"], outcomes)
lines = ["# Onko kotipaikkamalli oikeasti parempi?", "",
         "Paikallinen jatkotutkimus. Sama kehitysaineisto ja samat kiinteät mallit kuin aiemmin.", "",
         "## Voittajaosumat samoissa peleissä", "",
         f"Kotipaikaton piste-eromalli nimesi suosikin {len(common_ids)} otteluun. Näissä samoissa peleissä:", "",
         "| Malli | Oikein | Väärin | Osuus |", "|---|---:|---:|---:|"]
for label, metric in [("Piste-ero ilman kotipaikkaa", a), ("Piste-ero + kotipaikka", b)]:
    lines.append(f"| {label} | {metric['correct']} | {metric['favorites'] - metric['correct']} | {metric['correct'] / metric['favorites']:.1%} |")
lines += ["", f"Lisäksi kotipaikkamalli nimesi suosikin {len(home_extra)} peliin, jotka toinen jätti 50–50-arvioiksi.",
          f"Näissä lisävalinnoissa se osui {extra['correct']}/{len(home_extra)} kertaa.",
          "Useampaan peliin tehty valinta ei siis automaattisesti ole parempi tai luotettavampi valinta.", "",
          "## Prosenttiarvioiden eron epävarmuus", "",
          "Kaikki 108 peliä ovat mukana, myös tasavahvat arviot. Vertailu on parittainen:",
          "kunkin mallin virheestä vähennetään saman ottelun vertailumallin virhe.",
          "Kauden viikkoja otetaan uudelleen 5000 kertaa; saman viikon pelit pysyvät yhdessä.", "",
          "| Vertailu | Brier-ero | Suuntaa-antava 95 % bootstrap-vaihteluväli |",
          "|---|---:|---:|"]
for label, estimate in [("Piste-eromalli miinus Elo", point_vs_elo), ("Kotipaikkamalli miinus kotipaikaton piste-ero", home_vs_neutral)]:
    lines.append(f"| {label} | {estimate['difference']:+.4f} | {estimate['lower']:+.4f} … {estimate['upper']:+.4f} |")
lines += ["", "Negatiivinen ero suosii rivin ensimmäistä mallia; positiivinen vertailumallia.",
          "Jos vaihteluväli ulottuu nollan molemmille puolille, tämä koe ei erottele malleja vakuuttavasti.", "",
          "## Kolme eri asiaa, joita ei pidä sekoittaa", "",
          "1. Mallien paremmuuden epävarmuus: vaihteleeko niiden tulosten ero otteluotoksen mukana? Tätä tutkittiin nyt.",
          "2. Todennäköisyyksien kalibrointi: voittavatko esimerkiksi noin 60 % suosikit pitkässä seurannassa noin 60 % peleistä? Tätä ei vielä varmennettu.",
          "3. Yksittäisen pelin malliarvion epävarmuus: miten arvio muuttuu eri sovituksilla tai kokoonpano-oletuksilla? Tätä ei vielä laskettu.", "",
          "Yllä oleva vaihteluväli ei tarkoita ottelun voittoprosentin ±virhemarginaalia.",
          "Ottelun luontainen yllätysmahdollisuus on eri asia kuin epävarmuus mallista.", "",
          "## Rajat ja seuraava vaihe", "",
          f"Aineistossa on {point_vs_elo['weeks']} viikkolohkoa. Joukkueet toistuvat myös eri viikoilla,",
          "joten viikkolohkojenkin riippumattomuus on vain likimääräinen oletus.",
          "Välit kuvaavat tätä otosta kiinteillä parametreilla, eivät puuttuvaa dataa, tulevaa kautta",
          "tai parametrien sovitusepävarmuutta. Kehityskokeiden valintaharhaa ei korjata tällä.",
          "Seuraavaksi jäädytetään vertailtavat mallit ja kirjataan tulevien otteluiden arviot ennen tuloksia.",
          "Kalibrointia ja malliarvion herkkyyttä tutkitaan erikseen ennen käyttöliittymän virhemarginaalia.", ""]
(output / "model-uncertainty.md").write_text("\n".join(lines), encoding="utf-8")
(output / "model-uncertainty.json").write_text(json.dumps({
    "point_vs_elo": point_vs_elo, "home_vs_neutral": home_vs_neutral,
    "common_neutral": a, "common_home": b, "additional_home": extra,
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("\n".join(lines))
