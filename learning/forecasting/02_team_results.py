"""Laske joukkueiden tulokset paikallisesta, varmennetusta otteluaineistosta.

Aja: python3 learning/forecasting/02_team_results.py
Kauden yhteenveto on tutkimusvaihe; tätä ei käytetä menneiden pelien ennusteena.
"""

import json
from pathlib import Path

project_root = Path(__file__).resolve().parents[2]
data_file = project_root / "prototypes/paper-home/public/data/women-2025-26-matches.json"
matches = json.loads(data_file.read_text(encoding="utf-8"))

team_results = {}
seen_match_ids = set()

for match in matches:
    if match["id"] in seen_match_ids:
        raise ValueError(f"Sama ottelu kahdesti: {match['id']}")
    seen_match_ids.add(match["id"])

    teams = match["teams"]
    if len(teams) != 2 or {team["side"] for team in teams} != {"home", "away"}:
        raise ValueError(f"Tarkista ottelun joukkueet: {match['id']}")
    if teams[0]["id"] == teams[1]["id"]:
        raise ValueError(f"Joukkue pelaa itseään vastaan: {match['id']}")

    for team in teams:
        score = team["score"]
        if type(score) is not int or score < 0:
            raise ValueError(f"Puuttuva tai virheellinen lopputulos: {match['id']}")
    if teams[0]["score"] == teams[1]["score"]:
        raise ValueError(f"Tasatulos: tarkista ottelun tila: {match['id']}")

    for team in teams:
        # Vastustaja on tämän ottelun toinen joukkue.
        opponent = teams[1] if team["side"] == teams[0]["side"] else teams[0]
        team_id = team["id"]

        if team_id not in team_results:
            team_results[team_id] = {
                "name": team["name"],
                "wins": 0,
                "losses": 0,
                "points_for": 0,
                "points_against": 0,
            }

        result = team_results[team_id]
        result["points_for"] += team["score"]
        result["points_against"] += opponent["score"]

        if team["score"] > opponent["score"]:
            result["wins"] += 1
        else:
            result["losses"] += 1

print("Naisten Korisliiga 2025–26 · aineiston yhteenveto, ei virallinen sarjataulukko")
print(f"Otteluita: {len(matches)} · joukkueita: {len(team_results)}\n")
print(f"{'Joukkue':25} {'V':>3} {'T':>3} {'Tehdyt / O':>12} {'Päästetyt / O':>15}")

for result in sorted(team_results.values(), key=lambda result: result["name"]):
    games = result["wins"] + result["losses"]
    scored_average = result["points_for"] / games
    conceded_average = result["points_against"] / games
    print(
        f"{result['name']:25} {result['wins']:3} {result['losses']:3}"
        f" {scored_average:12.1f} {conceded_average:15.1f}"
    )

# Jokaisella pelatulla ottelulla on yksi voittaja ja yksi häviäjä.
assert sum(result["wins"] for result in team_results.values()) == len(matches)
assert sum(result["losses"] for result in team_results.values()) == len(matches)
assert sum(result["points_for"] for result in team_results.values()) == sum(
    result["points_against"] for result in team_results.values()
)
