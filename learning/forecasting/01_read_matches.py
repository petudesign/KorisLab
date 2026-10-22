"""Harjoitus 1: lue KorisLabin paikallinen otteluaineisto.

Aja projektin juuresta: python3 learning/forecasting/01_read_matches.py
Tämä harjoitus vain lukee tiedoston. Se ei tee vielä ennusteita.
"""

import json
from pathlib import Path

project_root = Path(__file__).resolve().parents[2]
data_file = project_root / "prototypes/paper-home/public/data/women-2025-26-matches.json"

matches = json.loads(data_file.read_text(encoding="utf-8"))
first_match = matches[0]

print("Otteluita aineistossa:", len(matches))
print("Ensimmäisen tietueen ottelupäivä:", first_match["date"])

for team in first_match["teams"]:
    print(team["name"], team["score"])
