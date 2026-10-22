"""Tarkastele ensimmäisen Elo-kokeen tuloksia ennusteen vahvuuden mukaan."""

import json
from pathlib import Path

from confidence_groups import summarize_groups

output = Path(__file__).resolve().parent / "results"
source = output / "women-2025-26-elo.json"
experiment = json.loads(source.read_text(encoding="utf-8"))
predictions, outcomes = experiment["predictions"], experiment["outcomes"]
samples = [
    ("Kuudennet ottelut", [prediction for prediction in predictions if prediction["sixth_for"]]),
    ("Molemmilla vähintään viisi aiempaa ottelua", [prediction for prediction in predictions if prediction["both_have_five"]]),
]
lines = [
    "# Elo-kokeen ennusteiden vahvuus", "",
    "Sama paikallinen Naisten Korisliigan 2025–26 koe. Ei uusia malliparametreja tai kalibrointia.",
    "Luokkarajat 55 % ja 65 % ovat tämän tarkastelun valintoja, eivät todistettuja laatuluokkia.",
    "Suosikki tarkoittaa suuremman todennäköisyyden saanutta joukkuetta, kotona tai vieraissa.",
    "Tasan 50–50-arvioista ei nimetä suosikkia. Tyhjä ryhmä esitetään puuttuvana tietona.", "",
]
saved_groups = {}
for label, sample in samples:
    summaries = summarize_groups(sample, outcomes)
    saved_groups[label] = summaries
    ties = sum(prediction["home_win_probability"] == 0.5 for prediction in sample)
    lines += [f"## {label}", "", f"Otteluita {len(sample)}, joista tasavahvoja {ties}.", "",
              "| Ryhmä | Pelejä | Arvioiden KA | Suosikin voitot | Toteutunut osuus | Brier |",
              "|---|---:|---:|---:|---:|---:|"]
    for summary in summaries:
        count = summary["matches"]
        if count:
            values = [str(count), f"{summary['mean_probability']:.1%}", f"{summary['wins']}/{count}",
                      f"{summary['win_rate']:.1%}", f"{summary['brier']:.3f}"]
        else:
            values = ["0", "—", "—", "—", "—"]
        lines.append("| " + " | ".join([summary["label"], *values]) + " |")
    lines += [""]

lines += [
    "## Havainto ja tulkinnan rajat", "",
    "- Kuudensien pelien lähes tasavahvassa ryhmässä suosikki voitti 2/4 ja kohtalaisessa 3/3.",
    "  Kolme voittoa kolmesta ei tarkoita, että noin 60 % arvio on oikeasti 100 %.",
    "- Laajemmassa otoksessa suurempi ennustettu etu liittyi suurempaan suosikin voitto-osuuteen.",
    "  Mallissa näyttää olevan erottelukykyä tällä aineistolla; tämä ei ole näyttö tulevien kausien tarkkuudesta.",
    "- Lähes tasavahvat suosikit voittivat vain 8/19. Ryhmä on pieni, joten emme vielä muuta mallia tämän perusteella.",
    "- Vahvoissa suosikeissa arvioiden keskiarvo oli noin 73 % ja toteutunut osuus noin 79 %.",
    "  Se voi viitata varovaisiin arvioihin tässä ryhmässä, mutta ei osoita systemaattista aliarviointia.",
    "- Brier mittaa todennäköisyyden ja tuloksen neliövirhettä. Ryhmien eri Brier-arvot eivät yksin todista kalibrointia.",
    "- Näitä ryhmiä ei pidä käyttää tämän saman aineiston jälkikäteiseen optimointiin ja kutsua tulosta riippumattomaksi testiksi.",
    "- Piste-eroja, poissaoloja, lepuutusta tai syy-seuraussuhteita ei päätellä voittaja-arvioista.", "",
    f"Lähtökoe: `{source.name}`. Otteluaineiston SHA256: `{experiment['metadata']['source_sha256']}`.", "",
]
report = output / "confidence-groups.md"
report.write_text("\n".join(lines), encoding="utf-8")
(output / "confidence-groups.json").write_text(json.dumps(saved_groups, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("\n".join(lines))
