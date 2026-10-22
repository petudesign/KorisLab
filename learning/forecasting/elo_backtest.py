"""Pieni, ajallisesti rajattu Elo-koe. Ei tuotantoon kalibroitu ennustemalli."""

from collections import defaultdict
from datetime import datetime
from itertools import groupby
from math import isfinite, log, exp


def expected_win(rating, opponent_rating):
    return 1 / (1 + 10 ** ((opponent_rating - rating) / 400))


def checked_matches(matches):
    seen = set()
    for match in matches:
        if match["id"] in seen:
            raise ValueError(f"Ottelu kahdesti: {match['id']}")
        seen.add(match["id"])
        date = datetime.fromisoformat(match["date"])
        if date.utcoffset() is None:
            raise ValueError("Ottelun aika tarvitsee aikavyöhykkeen")
        teams = match["teams"]
        if len(teams) != 2 or {team["side"] for team in teams} != {"home", "away"}:
            raise ValueError(f"Virheellinen joukkuepari: {match['id']}")
        if teams[0]["id"] == teams[1]["id"]:
            raise ValueError("Joukkue pelaa itseään vastaan")
        if any(type(team["score"]) is not int or team["score"] < 0 for team in teams):
            raise ValueError(f"Puuttuva lopputulos: {match['id']}")
        if teams[0]["score"] == teams[1]["score"]:
            raise ValueError(f"Tasatulos: {match['id']}")
    return sorted(matches, key=lambda match: (datetime.fromisoformat(match["date"]), match["id"]))


def run_backtest(matches, k=32, initial_ratings=None, home_logodds=0):
    """Arvioi koko päivä ennen sen tulosten käsittelyä.

    Aineistossa ei ole otteluiden päättymisaikoja. Siksi saman paikallisen päivän
    tuloksia ei käytetä toisen saman päivän ottelun ennusteeseen.
    """
    ratings = defaultdict(lambda: 1500.0)
    for team_id, rating in (initial_ratings or {}).items():
        if not isinstance(rating, (int, float)) or not isfinite(rating):
            raise ValueError("Lähtöluvun pitää olla äärellinen numero")
        ratings[team_id] = float(rating)
    games_played = defaultdict(int)
    predictions, outcomes = [], {}
    prior_games = prior_home_wins = 0
    ordered = checked_matches(matches)

    for _, day_matches in groupby(ordered, key=lambda match: datetime.fromisoformat(match["date"]).date()):
        day_matches = list(day_matches)
        pending = []

        # Ennusteessa käytetään vain ennen tätä päivää kertynyttä tilaa.
        for match in day_matches:
            teams = {team["side"]: team for team in match["teams"]}
            home, away = teams["home"], teams["away"]
            home_rating, away_rating = ratings[home["id"]], ratings[away["id"]]
            home_games, away_games = games_played[home["id"]], games_played[away["id"]]
            probability = expected_win(home_rating, away_rating)
            if home_logodds:
                odds = log(probability / (1 - probability)) + home_logodds
                probability = 1 / (1 + exp(-odds))
            predictions.append({
                "match_id": match["id"], "date": match["date"],
                "home": home["name"], "away": away["name"],
                "home_id": home["id"], "away_id": away["id"],
                "home_prior_games": home_games, "away_prior_games": away_games,
                "home_rating": home_rating, "away_rating": away_rating,
                "home_win_probability": probability,
                "flat_probability": 0.5,
                "historical_home_probability": (prior_home_wins + 1) / (prior_games + 2),
                "sixth_for": [team["name"] for team, count in [(home, home_games), (away, away_games)] if count == 5],
                "both_have_five": home_games >= 5 and away_games >= 5,
            })
            pending.append((match, home, away, probability))

        # Vasta nyt tulokset vaikuttavat seuraavien päivien arvioihin.
        for match, home, away, probability in pending:
            home_won = int(home["score"] > away["score"])
            change = k * (home_won - probability)
            ratings[home["id"]] += change
            ratings[away["id"]] -= change
            games_played[home["id"]] += 1
            games_played[away["id"]] += 1
            prior_games += 1
            prior_home_wins += home_won
            outcomes[match["id"]] = {
                "home_won": home_won, "home_score": home["score"], "away_score": away["score"],
            }

    return {"predictions": predictions, "outcomes": outcomes, "final_ratings": dict(ratings)}


def evaluate(predictions, outcomes, probability_key="home_win_probability"):
    """Brier: todennäköisyyden ja toteuman erotuksen neliö, pienempi parempi."""
    if not predictions:
        return {"matches": 0, "brier": None, "favorites": 0, "correct": 0, "ties": 0}
    squared_errors, correct, favorites = [], 0, 0
    for prediction in predictions:
        probability = prediction[probability_key]
        actual = outcomes[prediction["match_id"]]["home_won"]
        squared_errors.append((probability - actual) ** 2)
        if probability != 0.5:
            favorites += 1
            correct += int((probability > 0.5) == bool(actual))
    return {
        "matches": len(predictions), "brier": sum(squared_errors) / len(predictions),
        "favorites": favorites, "correct": correct, "ties": len(predictions) - favorites,
    }
