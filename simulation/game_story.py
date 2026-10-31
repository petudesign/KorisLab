"""Turn one game's play-by-play into a story: win probability over time and the turning points. (KOR-29)

python3 -m simulation.game_story --league men --season 2025-26 --match 123456
python3 -m simulation.game_story --all    # every league and season, once; the scheduled job keeps the current season fresh

Everything written comes from the events and the locked model. The text says what happened, never why.
"""
import argparse
from collections import Counter
import json
from pathlib import Path

from simulation.history import join_season
from simulation.refresh import LEAGUES, matches, possessions, site_dates
from simulation.win_probability import FOLDER, REGULATION, expected_inputs, game_states, home_win_probability, load

OUT = Path("prototypes/paper-home/public/data/stories")
MANIFEST = Path("prototypes/paper-home/source/game-stories.json")
SWING = 0.18  # A turn must move win probability this much, so ordinary back-and-forth is not a chapter.
POINTS = {"2pt": 2, "3pt": 3, "free_throw": 1}
MAX_CHAPTERS = 6
MIN_CHAPTER_SWING = 0.1  # The first and last legs can be small, and a small move is not a turn.
STEP = 1.5  # Replay seconds between events on the same clock.
display_name = lambda name: name.title() if name and name.isupper() else name or ""


def locked_params(league, version="v1"):
    return json.loads((FOLDER / f"model-lock-win-probability-{version}.json").read_text(encoding="utf-8"))["leagues"][league]["params"]


def timeline(game, gap, params):
    expected = params["home"] + params["strength"] * gap
    rows, home_points, away_points = [], 0, 0
    for period, clock, left, margin, event in game_states(game):
        elapsed = (period - 1) * 600 + 600 - clock if period <= 4 else REGULATION + 300 * (period - 10) - clock
        if event and event.get("made") and event["type"] in POINTS:
            if event["team"] == game["home"]:
                home_points += POINTS[event["type"]]
            else:
                away_points += POINTS[event["type"]]
        rows.append({"period": period, "clock": clock, "elapsed": elapsed, "margin": margin, "event": event, "home_points": home_points, "away_points": away_points,
                     "wp": home_win_probability(margin, left, expected, params["sigma"])})
    settle_technical_points(rows, game)
    return rows


def settle_technical_points(rows, game):
    """Technical free throws are outside the possessions. Both teams can have one in a quarter, which the margin
    alone would hide, so each team's points are checked against the quarter scores and the final."""
    record = game["record"]
    final = {t["source_id"]: t["score"] for t in record["teams"]}
    away = next(t for t in final if t != game["home"])
    wanted, home_total, away_total = {}, 0, 0
    for quarter in record["game"].get("periods") or []:
        home_total, away_total = home_total + quarter["home_score"], away_total + quarter["away_score"]
        wanted[quarter["period"]] = (home_total, away_total)
    home_extra = away_extra = 0
    for row, following in zip(rows, rows[1:] + [None]):
        row["home_points"] += home_extra
        row["away_points"] += away_extra
        if following is None or following["period"] != row["period"]:
            home_goal, away_goal = (final[game["home"]], final[away]) if following is None else wanted.get(row["period"], (row["home_points"], row["away_points"]))
            home_extra += home_goal - row["home_points"]
            away_extra += away_goal - row["away_points"]
            row["home_points"], row["away_points"] = home_goal, away_goal


def turning_points(rows, swing=SWING):
    """Zigzag over win probability: legs that move at least `swing` before turning back by as much."""
    points, low, high = [0], 0, 0
    direction = 0
    for i, row in enumerate(rows):
        if row["wp"] > rows[high]["wp"]:
            high = i
        if row["wp"] < rows[low]["wp"]:
            low = i
        if direction >= 0 and rows[high]["wp"] - row["wp"] >= swing and high > points[-1]:
            points.append(high)
            direction, low = -1, i
        elif direction <= 0 and row["wp"] - rows[low]["wp"] >= swing and low > points[-1]:
            points.append(low)
            direction, high = 1, i
    if points[-1] != len(rows) - 1:
        points.append(len(rows) - 1)
    return points


def leg_summary(rows, start, end, home, names):
    scored = Counter()
    by_player = Counter()
    for row in rows[start + 1:end + 1]:
        event = row["event"]
        if event and event.get("made") and event["type"] in POINTS:
            points = POINTS[event["type"]]
            scored[event["team"] == home] += points
            by_player[(event["team"] == home, event.get("player"))] += points
    gaining_home = rows[end]["wp"] >= rows[start]["wp"]
    side = [(player, pts) for (is_home, player), pts in by_player.most_common() if is_home == gaining_home and player]
    return {"from": rows[start]["elapsed"], "to": rows[end]["elapsed"], "wp_from": round(rows[start]["wp"], 3), "wp_to": round(rows[end]["wp"], 3),
            "home_points": scored[True], "away_points": scored[False], "gaining": "home" if gaining_home else "away",
            "margin_from": rows[start]["margin"], "margin_to": rows[end]["margin"], "score_to": [rows[end]["home_points"], rows[end]["away_points"]],
            "period_to": rows[end]["period"], "clock_to": rows[end]["clock"],
            "leader": {"name": names.get(side[0][0], ""), "points": side[0][1]} if side else None}


def build_story(game, gap, league, season, params):
    record, home = game["record"], game["home"]
    teams = {t["source_id"]: t for t in record["teams"]}
    away = next(t for t in teams if t != home)
    names = {p["source_player_id"]: display_name(p.get("display_name")) for t in record["teams"] for p in t["players"]}
    rows = timeline(game, gap, params)
    marks = turning_points(rows)
    legs = [leg_summary(rows, a, b, home, names) for a, b in zip(marks, marks[1:]) if abs(rows[b]["wp"] - rows[a]["wp"]) >= MIN_CHAPTER_SWING]
    # The chapters are the biggest swings, in game order; the last leg always closes the story.
    keep = sorted(sorted(legs[:-1], key=lambda leg: -abs(leg["wp_to"] - leg["wp_from"]))[:MAX_CHAPTERS - 1], key=lambda leg: leg["from"]) + legs[-1:]
    biggest = max((r for r in rows[1:] if r["event"] and r["event"].get("made")), key=lambda r: abs(r["wp"] - rows[rows.index(r) - 1]["wp"]))
    i = rows.index(biggest)
    last_lead_change = max((r["elapsed"] for a, r in zip(rows, rows[1:]) if a["margin"] * r["margin"] <= 0 and r["margin"] != a["margin"]), default=0)
    if rows[-1]["home_points"] != teams[home]["score"] or rows[-1]["away_points"] != teams[away]["score"]:
        raise ValueError(f"{game['match_id']}: running score does not reach the final")
    story_events = replay_events(rows, home, names)
    return {"schema_version": "0.2", "model": "win-probability-v1", "league": league, "season": season, "match_id": game["match_id"], "date": game["date"],
            "home": {"id": home, "name": teams[home]["name"], "score": teams[home]["score"]},
            "away": {"id": away, "name": teams[away]["name"], "score": teams[away]["score"]},
            "quarters": record["game"].get("periods") or [], "duration": story_events[-1]["t"],
            "pregame_home_wp": round(rows[0]["wp"], 3), "chapters": keep, "last_lead_change": last_lead_change,
            "ends": attacking_ends(game), "events": story_events,
            "biggest_play": {"elapsed": int(biggest["elapsed"]), "period": biggest["period"], "clock": biggest["clock"], "type": biggest["event"]["type"],
                             "team": "home" if biggest["event"]["team"] == home else "away", "player": names.get(biggest["event"].get("player"), ""),
                             "wp_from": round(rows[i - 1]["wp"], 3), "wp_to": round(biggest["wp"], 3)}}


def attacking_ends(game):
    """Which end the home team shoots at in each period: most of its shots are on that half."""
    left, total = Counter(), Counter()
    for possession in game["possessions"]:
        for event in possession["events"]:
            if "x" in event:
                is_home = event["team"] == game["home"]
                left[possession["period"]] += (event["x"] < 50) == is_home
                total[possession["period"]] += 1
    return {str(period): "L" if left[period] * 2 >= total[period] else "R" for period in total}


def replay_events(rows, home, names):
    """The game as a replay. An assist joins its shot and a steal its turnover, so one moment is one line.

    `t` is the elapsed time, nudged apart when several events share a clock (free throws), so each gets its moment."""
    events, t = [], -STEP
    for row in rows:
        source = row["event"]
        side = lambda team: "h" if team == home else "a"
        if source:
            last = events[-1] if events else None
            same = last and last["c"] == row["clock"] and last["p"] == row["period"]
            name = names.get(source.get("player"), "")
            if source["type"] == "assist":  # An and-one foul can come between the basket and its assist.
                shot = next((e for e in reversed(events) if e["c"] == row["clock"] and e["p"] == row["period"] and e["k"] in POINTS and e.get("m") and e["s"] == side(source["team"])), None)
                if shot:
                    shot["as"] = name
                    continue
            if source["type"] == "steal" and same and last["k"] == "turnover":
                last.update(k="steal", s=side(source["team"]), lost=last["n"], n=name)
                continue
            if source["type"] == "turnover" and same and last["k"] == "steal":
                last["lost"] = name
                continue
        else:
            last = events[-1] if events else None
            if last and (row["home_points"], row["away_points"]) == (last["h"], last["a"]) and row["period"] == last["p"]:
                continue
        t = max(row["elapsed"], t + STEP)
        event = {"t": round(t, 1), "p": row["period"], "c": row["clock"], "h": row["home_points"], "a": row["away_points"], "w": round(row["wp"], 3)}
        if source:
            event.update(k=source["type"], s=side(source["team"]), n=names.get(source.get("player"), ""))
            for key, field in (("made", "m"), ("x", "x"), ("y", "y"), ("subtype", "st")):
                if source.get(key) is not None:
                    event[field] = source[key]
        else:
            event["k"] = "period"
        events.append(event)
    return events


def write_stories(league, season, games):
    """One file per game, and the list of games that have a story so the site can offer the tab."""
    gaps, params, ids = expected_inputs(games), locked_params(league), []
    OUT.mkdir(parents=True, exist_ok=True)
    for game in games:
        story = build_story(game, gaps[game["match_id"]], league, season, params)
        path = OUT / f"{league}-{season}-{game['match_id']}.json"
        path.write_text(json.dumps(story, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        ids.append(game["match_id"])
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    manifest[f"{league}-{season}"] = sorted(ids)
    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), separators=(",", ":")) + "\n", encoding="utf-8")
    return len(ids)


def write_every_story(cache=Path("data/cache/pbp")):
    for league, config in LEAGUES.items():
        for season, _, _ in config["history"]:
            print(league, season, write_stories(league, season, load(league, season)[0]))
        season, path, _ = config["current"]
        records = matches(path)
        games, excluded = possessions(records, cache, config["slug"], season)
        print(league, season, write_stories(league, season, join_season(records, games, 1.0, site_dates(league, season))), "of", len(records), "excluded", len(excluded))


def candidates(league, season):
    games, _ = load(league, season)
    gaps, params = expected_inputs(games), locked_params(league)
    rows = []
    for game in games:
        tl = timeline(game, gaps[game["match_id"]], params)
        legs = len(turning_points(tl)) - 1
        teams = {t["source_id"]: t for t in game["record"]["teams"]}
        away = next(t for t in teams if t != game["home"])
        rows.append((legs, game["match_id"], teams[game["home"]]["name"], teams[away]["name"], teams[game["home"]]["score"], teams[away]["score"], game["date"], round(tl[0]["wp"], 2), max(t["period"] for t in tl)))
    return sorted(rows, reverse=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--league")
    parser.add_argument("--season")
    parser.add_argument("--match")
    args = parser.parse_args()
    if args.all:
        write_every_story()
    elif not args.match:
        for row in candidates(args.league, args.season)[:12]:
            print(row)
    else:
        games, _ = load(args.league, args.season)
        game = next(g for g in games if g["match_id"] == args.match)
        story = build_story(game, expected_inputs(games)[args.match], args.league, args.season, locked_params(args.league))
        path = OUT / f"{args.league}-{args.season}-{args.match}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(story, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(json.dumps({k: v for k, v in story.items() if k != "events"}, ensure_ascii=False, indent=1))
