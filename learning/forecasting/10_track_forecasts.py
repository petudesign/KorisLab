"""Päivitä paikallinen seuranta olemassa olevasta kausiaineistosta.

Aja: python3 learning/forecasting/10_track_forecasts.py
Ei hae uutta dataa, ajasta töitä tai julkaise ennusteita sivustolle.
"""

from datetime import datetime, timezone
import argparse
import hashlib
import json
from pathlib import Path

from forecast_tracker import HELSINKI, append_history, digest, evaluate_history, forecasts

folder = Path(__file__).resolve().parent
root = folder.parents[1]
parser = argparse.ArgumentParser(description="Paikallinen lukittujen mallien ennusteseuranta")
parser.add_argument("--league", choices=["women", "men"], default="women")
args = parser.parse_args()
league = args.league
prefix = "men-" if league == "men" else ""
league_name = "Miesten Korisliiga" if league == "men" else "Naisten Korisliiga"
source = root / f"prototypes/paper-home/public/data/{league}-2026-27-matches.json"
raw = source.read_bytes()
games = json.loads(raw)
lock = json.loads((folder / ("model-lock-men-v1.json" if league == "men" else "model-lock-v1.json")).read_text())
if lock.get("league", "women") != league:
    raise ValueError("Mallilukko kuuluu eri liigaan")
now = datetime.now(timezone.utc)
records = forecasts(games, lock, now, hashlib.sha256(raw).hexdigest())
history, latest, added = append_history(folder / f"history/{prefix}forecasts-v1.jsonl", records)
evaluated = evaluate_history(history, games, digest(lock), now)
output = folder / "results"
output.mkdir(exist_ok=True)
seasons = json.loads((root / "prototypes/paper-home/source/seasons.json").read_text())
updated = seasons[league]["2026-27"].get("updatedAt")
lines = [f"# Ennusteseuranta · {league_name} 2026–27", "",
         "**Paikallinen mallin arvio, ei julkaistu tai kalibroitu ennustepalvelu.**", "",
         f"Seuranta-ajon aika: {now.astimezone(HELSINKI).isoformat()}. Lähdekoosteen päivitys: {updated}.",
         f"Malliversio: `{lock['version']}`. Parametrit pysyvät samoina; muuttuvat vain lähtötiedot.",
         f"Tulevia arvioita: {len(latest)}. Uusia historiamerkintöjä tällä ajolla: {added}.", "",
         "## Seuraavat ottelut", "",
         "Arviot käyttävät vain ennen tämän päivän alkua varmennettuja tuloksia.",
         "Poissaoloja, minuutti- tai lepuutustietoja ei ole huomioitu. Aineisto ei päivity tällä skriptillä.",
         "Kummassakin prosenttiparissa kotijoukkue on ensin ja vierasjoukkue toisena.", "",
         "| Alku (Suomen aikaa) | Ottelu | Aiempia pelejä koti/vieras | Piste-ero: koti / vieras | + kotipaikka: koti / vieras | Arvio tallennettu |",
         "|---|---|---:|---:|---:|---|"]
for record in latest[:12]:
    date = datetime.fromisoformat(record["kickoff"]).strftime("%d.%m.%Y %H:%M")
    percentages = [f"{p:.0%} / {1-p:.0%}" for p in record["probabilities"].values()]
    lines.append(f"| {date} | {record['home']} – {record['away']} | {record['home_prior_games']}/{record['away_prior_games']} | "
                 + " | ".join(percentages) + f" | {datetime.fromisoformat(record['created_at']).astimezone(HELSINKI):%d.%m.%Y %H:%M} |")
lines += ["", f"Taulukossa näytetään seuraavat 12 ottelua. Kaikki arviot ovat {prefix}latest-forecasts.json-tiedostossa.",
          "Vain muutamaan peliin perustuva alkukauden arvio on erityisen alustava.", "",
          "## Tulosten seuranta", "",
          f"Ennalta tallennetulla, seitsemän päivän ikkunan arviolla arvioitavia päättyneitä otteluita: **{len(evaluated)}**.",
          "Tuloksia tarkastellaan jatkuvasti. Mallimuutokset vaativat perustelun ja version; kiinteää ottelumäärärajaa ei ole. Vanhoista jo pelatuista peleistä ei tehdä jälkikäteisiä ennusteita tähän seurantaan.", "",
          "| Ottelu | Tulos | Piste-ero: kotiarvio / osuma | Kotipaikka: kotiarvio / osuma |",
          "|---|---:|---|---|"]
for entry in evaluated:
    record = entry["forecast"]
    actual = entry["home_score"] > entry["away_score"]
    cells = []
    for probability in record["probabilities"].values():
        correct = "Tasavahva" if probability == 0.5 else "Oikein" if (probability > 0.5) == actual else "Väärin"
        cells.append(f"{probability:.0%} / {correct}")
    lines.append(f"| {record['home']} – {record['away']} | {entry['home_score']}–{entry['away_score']} | " + " | ".join(cells) + " |")
lines += ["", "## Historia ja päivittyvä näkymä", "",
          f"`history/{prefix}forecasts-v1.jsonl` saa vain uusia rivejä. Sama lähtötilanne ei luo uutta kopiota.",
          "Jos data muuttuu, uusi arvio tallennetaan erikseen. Seitsemän päivän ikkunaan siirtyminen luo myös uuden merkinnän.",
          "Arvioinnissa valitaan ensimmäinen ennen ottelua tallennettu arvio seitsemän päivän ikkunasta.",
          "Muuttunut joukkuepari tai alkamisaika vaatii uuden kelpoisen arvion; vanhaa ei arvioida eri ottelutiedoilla.",
          "Historialla on paikalliset tarkistussummat; tämä ei ole ulkopuolisesti varmennettu ennusterekisteri.",
          "Pelien prosentteihin ei vielä liitetä virhemarginaalia. Ei tausta-ajastusta tai julkaisua.", ""]
(output / f"{prefix}forecast-tracker.md").write_text("\n".join(lines), encoding="utf-8")
(output / f"{prefix}latest-forecasts.json").write_text(json.dumps({"run_at": now.isoformat(), "source_updated_at": updated,
    "model_sha256": digest(lock), "forecasts": latest, "evaluated": evaluated}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Tulevia ennusteita {len(latest)} · uusia merkintöjä {added} · arvioitavia toteumia {len(evaluated)}")
print(output / f"{prefix}forecast-tracker.md")
