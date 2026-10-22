"""Simulation packs for upcoming games: distributions plus a few full simulated games.

Run through `python3 -m simulation.refresh`, which prepares the history first.
"""
from collections import Counter
from datetime import date, timedelta
import json
from statistics import mean, median

from simulation.court import ZONES
from simulation.player_sim import PRIORS, GameSimulator

VERSION = "player-sim-v1"


def percentile(values, q):
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(q * len(ordered)))]


def player_spot(model, pid):
    """Average shot location on the left half; the viewer uses it as the player's floor spot."""
    points = [xy for zone in ZONES for xy in model.coords.get((pid, zone), [])]
    if not points:
        return None
    return [round(mean(x for x, _ in points), 1), round(mean(y for _, y in points), 1)]


def jersey_numbers(model):
    numbers = {}
    for _, _, record in sorted(model.records, key=lambda r: r[0]):
        for team in record["teams"]:
            for player in team["players"]:
                if player.get("jersey_number") not in (None, ""):
                    numbers[player["source_player_id"]] = str(player["jersey_number"])
    return numbers


def how_wins_happen(results, team, other):
    wins = [r for r in results if r["score"][team] > r["score"][other]]
    if not wins:
        return {"wins": 0}
    margin = lambda r: r["score"][team] - r["score"][other]
    deciding = Counter()
    for r in wins:
        quarters = r["quarters"][:4]
        best = max(range(len(quarters)), key=lambda i: quarters[i][team] - quarters[i][other])
        deciding[f"Q{best + 1}"] += 1
    sign = 1 if team == next(iter(results[0]["score"])) else -1
    return {"wins": len(wins), "mean_margin": round(mean(margin(r) for r in wins), 1),
            "led_after_three": round(mean(sign * r["after_three"] > 0 for r in wins), 3),
            "comeback_after_three": round(mean(sign * r["after_three"] < 0 for r in wins), 3),
            "close": round(mean(margin(r) <= 5 for r in wins), 3),
            "comfortable": round(mean(margin(r) >= 15 for r in wins), 3),
            "overtime": round(mean(r["overtime"] for r in wins), 3),
            "best_quarter": {q: round(c / len(wins), 3) for q, c in deciding.most_common()}}


def pack(model, simulator, match, simulations, cutoff):
    home, away = simulator.home, simulator.away
    results = [simulator.play(seed) for seed in range(simulations)]
    margins = [r["score"][home] - r["score"][away] for r in results]
    players, numbers = [], jersey_numbers(model)
    for team in (home, away):
        for pid, share in sorted(simulator.rosters[team]["share"].items(), key=lambda item: -item[1]):
            values = {stat: [r["stats"].get(pid, {}).get(stat, 0) for r in results] for stat in ("points", "assists", "rebounds", "steals")}
            players.append({"id": pid, "team": team, "name": model.names.get(pid, pid), "number": numbers.get(pid), "minute_share": round(share, 3),
                            "starter": pid in simulator.rosters[team]["starters"], "spot": player_spot(model, pid),
                            "points": {"mean": round(mean(values["points"]), 1), "p10": percentile(values["points"], 0.1),
                                       "p90": percentile(values["points"], 0.9),
                                       "twenty_plus": round(mean(v >= 20 for v in values["points"]), 3)},
                            **{stat: round(mean(values[stat]), 1) for stat in ("assists", "rebounds", "steals")}})
    pairs = Counter()
    for r in results:
        pairs.update(r["pairs"])
    team_of = {p["id"]: p["team"] for p in players}
    top_pairs = [{"team": team_of.get(a), "passer": a, "scorer": s, "per_game": round(count / simulations, 2)}
                 for (a, s), count in pairs.most_common(12)]

    def featured(label, candidates, target):
        if not candidates:
            return None
        chosen = min(candidates, key=lambda r: (abs(r["score"][home] - r["score"][away] - target), r["seed"]))
        game = simulator.play(chosen["seed"], keep_log=True)
        side = {home: "home", away: "away"}
        # Teams are written as sides to keep the event log compact.
        log = [{**event, "team": side[event["team"]]} for event in game["log"]]
        return {"label": label, "seed": game["seed"], "score": game["score"], "quarters": game["quarters"], "log": log}
    home_wins = [r for r in results if r["score"][home] > r["score"][away]]
    away_wins = [r for r in results if r["score"][away] > r["score"][home]]
    games = [featured("typical_home_win", home_wins, median([r["score"][home] - r["score"][away] for r in home_wins]) if home_wins else 0),
             featured("typical_away_win", away_wins, median([r["score"][home] - r["score"][away] for r in away_wins]) if away_wins else 0),
             featured("closest", results, 0)]
    histogram = Counter(max(-40, min(40, m)) for m in margins)
    return {
        "schema_version": "0.1", "model": VERSION,
        "data_cutoff": cutoff, "simulations": simulations, "priors": PRIORS,
        "match": {"id": match["source_match_id"], "date": match["scheduled_date"], "time": match.get("scheduled_time"),
                  "venue": match.get("venue"), "home": {"id": home, "name": model.team_names[home]},
                  "away": {"id": away, "name": model.team_names[away]}},
        "summary": {"home_win_probability": round(len(home_wins) / simulations, 3),
                    "overtime_probability": round(mean(r["overtime"] for r in results), 3),
                    "mean_score": {home: round(mean(r["score"][home] for r in results), 1), away: round(mean(r["score"][away] for r in results), 1)},
                    "margin": {"mean": round(mean(margins), 1), "p10": percentile(margins, 0.1), "p90": percentile(margins, 0.9)},
                    "lead_changes": round(mean(r["lead_changes"] for r in results), 1)},
        "margin_histogram": [{"margin": m, "share": round(histogram[m] / simulations, 4)} for m in range(-40, 41)],
        "how_wins_happen": {home: how_wins_happen(results, home, away), away: how_wins_happen(results, away, home)},
        "players": players, "assist_pairs": top_pairs, "games": [g for g in games if g],
        "limitations": ["Simulated play, not a forecast of individual events",
                        "Availability and injuries are not known; rosters come from the latest games",
                        "Player positions between events are modelled from each player's own shot locations"],
    }


def publish_packs(model, schedule, out_dir, *, today, games=16, horizon_days=14, simulations=1000):
    """Write packs for unplayed games within the horizon and remove packs that are no longer upcoming.

    Output is deterministic for the same inputs, so an unchanged season causes no diff.
    """
    cutoff = max(day for day, _, _ in model.records)
    ids = {name: tid for tid, name in model.team_names.items()}
    last_day = (date.fromisoformat(today) + timedelta(days=horizon_days)).isoformat()
    upcoming = sorted((m for m in schedule if m["status"] != "Played" and max(today, cutoff) <= m["scheduled_date"] <= last_day
                       and m["home"]["name"] in ids and m["away"]["name"] in ids),
                      key=lambda m: (m["scheduled_date"], m.get("scheduled_time") or "", m["source_match_id"]))[:games]
    out_dir.mkdir(parents=True, exist_ok=True)
    index, written = [], {"index.json"}
    for match in upcoming:
        simulator = GameSimulator(model, ids[match["home"]["name"]], ids[match["away"]["name"]])
        result = pack(model, simulator, match, simulations, cutoff)
        name = f"{match['source_match_id']}.json"
        (out_dir / name).write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        written.add(name)
        index.append({**result["match"], "home_win_probability": result["summary"]["home_win_probability"]})
    for stale in out_dir.glob("*.json"):
        if stale.name not in written:
            stale.unlink()
    (out_dir / "index.json").write_text(json.dumps({"model": VERSION, "data_cutoff": cutoff, "games": index},
                                                   ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return index
