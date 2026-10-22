"""Poimi historiallista ennustetta varten vain aiemmat ottelut.

Aja: python3 learning/forecasting/03_before_match.py
Tämä esimerkki valitsee Peli-Karhujen aineistossa olevan kuudennen ottelun.
Sen lopputulosta ei käytetä lähtötietojen laskennassa.
"""

import json
from datetime import datetime
from pathlib import Path


def match_time(game):
    return datetime.fromisoformat(game["date"])


project_root = Path(__file__).resolve().parents[2]
data_file = project_root / "prototypes/paper-home/public/data/women-2025-26-matches.json"
matches = json.loads(data_file.read_text(encoding="utf-8"))

team_name = "Peli-Karhut"
team_ids = {
    team["id"] for game in matches for team in game["teams"]
    if team["name"] == team_name
}
if len(team_ids) != 1:
    raise ValueError("Joukkueen nimeä ei voitu yhdistää yhteen tunnisteeseen")
team_id = next(iter(team_ids))

games = []
for match in matches:
    for team in match["teams"]:
        if team["id"] == team_id:
            games.append(match)
            break

ordered_games = sorted(games, key=match_time)
if len(ordered_games) < 6:
    raise ValueError("Esimerkki tarvitsee vähintään kuusi ottelua")
target_match = ordered_games[5]
kickoff = match_time(target_match)

# Ensin aikaraja, sitten järjestys, lopuksi viiden ottelun valinta.
past = [game for game in games if match_time(game) < kickoff]
past = sorted(past, key=match_time)
recent = past[-5:]

points_for = 0
points_against = 0

print(f"{team_name} · aineiston kuudes ottelu {kickoff:%d.%m.%Y}")
print("Laskennassa käytettävät aiemmat ottelut:")
for game in recent:
    for team in game["teams"]:
        if team["id"] == team_id:
            points_for += team["score"]
        else:
            points_against += team["score"]
    names = " – ".join(team["name"] for team in game["teams"])
    print(f"  {match_time(game):%d.%m.%Y} · {names}")

print(f"\nTehdyt pisteet / ottelu: {points_for / len(recent):.1f}")
print(f"Päästetyt pisteet / ottelu: {points_against / len(recent):.1f}")
print("Nämä ovat lähtötietoja, eivät vielä voittotodennäköisyys.")

assert len(recent) == 5
assert all(match_time(game) < kickoff for game in recent)
assert target_match["id"] not in {game["id"] for game in recent}
