"""Lukitut mallit, muuttumaton paikallinen historia ja ennalta rajattu arviointi."""

from collections import defaultdict
from datetime import datetime, time, timedelta
import fcntl
import hashlib
import json
from zoneinfo import ZoneInfo

from comparison_models import sigmoid
from elo_backtest import checked_matches

HELSINKI = ZoneInfo("Europe/Helsinki")


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def kickoff(game):
    date = datetime.fromisoformat(game["date"])
    if game.get("time"):
        return datetime.combine(date.date(), time.fromisoformat(game["time"]), HELSINKI)
    if date.tzinfo is None:
        raise ValueError(f"Ottelun alkamisaika puuttuu: {game['id']}")
    return date.astimezone(HELSINKI)


def prepare_games(games):
    seen = set()
    for game in games:
        if game["id"] in seen:
            raise ValueError("Sama ottelu kahdesti")
        seen.add(game["id"])
        teams = game["teams"]
        if len(teams) != 2 or {team["side"] for team in teams} != {"home", "away"} or teams[0]["id"] == teams[1]["id"]:
            raise ValueError(f"Virheellinen joukkuepari: {game['id']}")
        kickoff(game)
        if game.get("verified") is True:
            checked_matches([{**game, "date": kickoff(game).isoformat()}])


def forecasts(games, lock, now, source_sha256):
    if now.utcoffset() is None:
        raise ValueError("Ajankohdan pitää sisältää aikavyöhyke")
    prepare_games(games)
    local_day = now.astimezone(HELSINKI).date()
    totals, counts = defaultdict(float), defaultdict(int)
    evidence = []
    for game in sorted(games, key=kickoff):
        if game.get("verified") is not True or kickoff(game).date() >= local_day:
            continue
        teams = {team["side"]: team for team in game["teams"]}
        home, away = teams["home"], teams["away"]
        margin = home["score"] - away["score"]
        totals[home["id"]] += margin
        totals[away["id"]] -= margin
        counts[home["id"]] += 1
        counts[away["id"]] += 1
        evidence.append({"match_id": game["id"], "kickoff": kickoff(game).isoformat(),
                         "home_id": home["id"], "away_id": away["id"], "home_score": home["score"], "away_score": away["score"]})

    records = []
    for game in sorted(games, key=kickoff):
        start = kickoff(game)
        if game.get("status") != "fixture" or game.get("verified") is True or start <= now:
            continue
        teams = {team["side"]: team for team in game["teams"]}
        home, away = teams["home"], teams["away"]
        feature = (totals[home["id"]] / (counts[home["id"]] + lock["prior_games"])
                   - totals[away["id"]] / (counts[away["id"]] + lock["prior_games"])) / lock["feature_divisor"]
        payload = {
            "match_id": game["id"], "kickoff": start.isoformat(),
            "home": home["name"], "away": away["name"], "home_id": home["id"], "away_id": away["id"],
            "home_prior_games": counts[home["id"]], "away_prior_games": counts[away["id"]],
            "feature": feature, "model_version": lock["version"], "model_sha256": digest(lock),
            "evidence": evidence, "evaluation_eligible": start - timedelta(days=7) <= now,
            "probabilities": {model: sigmoid(parameters["bias"] + parameters["slope"] * feature)
                              for model, parameters in lock["models"].items()},
        }
        signature = digest(payload)
        record = {**payload, "input_signature": signature, "created_at": now.isoformat(), "source_sha256": source_sha256}
        record["record_id"] = digest(record)
        records.append(record)
    return records


def append_history(path, records):
    """Vain lisäyksiä: aiempaa ennustetta ei korvata uudella."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+", encoding="utf-8") as stream:
        fcntl.flock(stream, fcntl.LOCK_EX)
        stream.seek(0)
        history = [json.loads(line) for line in stream if line.strip()]
        for record in history:
            if digest({key: value for key, value in record.items() if key != "record_id"}) != record["record_id"]:
                raise ValueError("Historiaa on muutettu tai se on vaurioitunut")
        signatures = {record["input_signature"]: record for record in history}
        latest, added = [], 0
        for record in records:
            if record["input_signature"] not in signatures:
                stream.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
                history.append(record)
                signatures[record["input_signature"]] = record
                added += 1
            latest.append(signatures[record["input_signature"]])
        stream.flush()
    return history, latest, added


def evaluate_history(history, games, model_sha256, now):
    """Ensimmäinen kelpoinen seitsemän päivän ennuste, ei jälkikäteen paras."""
    results = {game["id"]: game for game in games if game.get("verified") is True and kickoff(game) < now}
    chosen = {}
    for record in sorted(history, key=lambda record: datetime.fromisoformat(record["created_at"])):
        game = results.get(record["match_id"])
        if not game or record["model_sha256"] != model_sha256:
            continue
        start = kickoff(game)
        created = datetime.fromisoformat(record["created_at"])
        teams = {team["side"]: team for team in game["teams"]}
        if record["kickoff"] != start.isoformat() or record["home_id"] != teams["home"]["id"] or record["away_id"] != teams["away"]["id"]:
            continue
        if start - timedelta(days=7) <= created < start and record["match_id"] not in chosen:
            chosen[record["match_id"]] = {"forecast": record, "home_score": teams["home"]["score"], "away_score": teams["away"]["score"]}
    return list(chosen.values())
