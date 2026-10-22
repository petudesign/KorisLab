"""Join published possessions with box-score records into weighted simulation history."""
import json
from pathlib import Path


def join_season(records, possession_games, weight, dates=None):
    """`records`: normalized matches; `possession_games`: dicts with match_id and possessions.
    `dates` fills kickoff dates that a record lacks."""
    by_id = {r["game"]["source_id"]: r for r in records}
    games = []
    for game in possession_games:
        record = by_id.get(game["match_id"])
        if record is None:
            continue
        home = next(t["source_id"] for t in record["teams"] if t.get("home_away") == "home")
        date = record["game"].get("scheduled_at") or (dates or {}).get(game["match_id"])
        if not date:
            continue
        games.append({"match_id": game["match_id"], "date": str(date)[:10],
                      "weight": weight, "home": home, "possessions": game["possessions"], "record": record})
    return games


def load_season(records_path, possessions_path, weight):
    records = json.loads(Path(records_path).read_text(encoding="utf-8"))["matches"]
    return join_season(records, json.loads(Path(possessions_path).read_text(encoding="utf-8"))["games"], weight)


def load_history(seasons):
    """`seasons`: (records path, possessions path, weight) tuples, newest weight usually 1."""
    games = [game for season in seasons for game in load_season(*season)]
    return sorted(games, key=lambda game: (game["date"], game["match_id"]))
