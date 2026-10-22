"""Split box-score-reconciled play-by-play into possessions with both lineups.

A possession belongs to one offense and ends on a made field goal, a made final
free throw, a defensive rebound, a turnover or the end of a period. Technical
free throws are scored outside possessions. Lineups come from the on/off
reconstruction. A game whose lineups do not reconcile yields no possessions,
unless the caller accepts possessions without lineups; scoring must still match.
"""
from normalization.basketfi_onoff import clock_seconds, reconstruct_game
from normalization.basketfi_pbp import fixture_data, period_number, play_by_play_periods

TECHNICAL_FOULS = {"technical", "benchTechnical", "coachTechnical"}
# After free throws for these fouls the shooting team keeps the ball.
RETAINED_BALL_FOULS = {"unsportsmanlike", "disqualifying"}
COUNTS = ("points", "fga", "three_pa", "fta", "offensive_rebounds", "turnovers")
STAT_EVENTS = {"2pt", "3pt", "freeThrow", "rebound", "assist", "turnover", "steal", "block"}


def last_free_throw(subtype):
    parts = str(subtype or "").split("Of")
    return len(parts) == 2 and parts[0] == parts[1]


def events_without_lineups(payload, record):
    """Events in the on/off processing order, with empty lineups for statistical events."""
    if {c["entityId"] for c in fixture_data(payload).get("competitors", [])} != {t["source_id"] for t in record["teams"]}:
        raise ValueError("Event teams differ from box score")
    periods = play_by_play_periods(payload) or {}
    keys = sorted(periods, key=int)
    # Older snapshots carry no period scores; four ended periods are still required.
    expected = len(record["game"].get("periods") or []) or len(keys)
    if keys[:4] != ["1", "2", "3", "4"] or len(keys) != expected:
        raise ValueError("Incomplete periods")
    events, seen = [], set()
    for key in keys:
        if periods[key].get("ended") is not True:
            raise ValueError("Unfinished period")
        for event in sorted(periods[key]["events"], key=lambda e: -clock_seconds(e.get("clock"))):
            event_id = event.get("eventId")
            if not event_id or event_id in seen or period_number(event.get("periodId")) != int(key):
                raise ValueError("Duplicate or misplaced event")
            seen.add(event_id)
            if event.get("eventType") != "substitution":
                lineups = {} if event.get("eventType") in STAT_EVENTS else None
                events.append((int(key), event, clock_seconds(event.get("clock")), lineups))
    return events


def possessions_for_game(payload, record, *, diagnostics=None, require_lineups=True):
    diagnostics = diagnostics if diagnostics is not None else {}
    events = []
    try:
        reconstruct_game(payload, record, diagnostics={}, on_event=lambda *args: events.append(args))
        diagnostics["lineups"] = True
    except ValueError as error:
        if require_lineups:
            raise
        events = events_without_lineups(payload, record)
        diagnostics.update(lineups=False, lineup_error=str(error))
    teams = [t["source_id"] for t in record["teams"]]
    other = {teams[0]: teams[1], teams[1]: teams[0]}
    score = dict.fromkeys(teams, 0)
    outside_points = dict.fromkeys(teams, 0)
    possessions, steals, unrecorded = [], set(), []
    current, period, last_foul = None, None, None

    def close(end, seconds):
        nonlocal current
        current.update(end=end, end_clock=seconds)
        possessions.append(current)
        current = None

    def open_for(tid, lineups):
        nonlocal current
        previous = possessions[-1] if possessions and possessions[-1]["period"] == period else None
        current = {"period": period, "offense": tid, "defense": other[tid],
                   "start": previous["end"] if previous else "period_start",
                   # The ball changes hands when the previous possession ends.
                   "start_clock": previous["end_clock"] if previous else (600 if period <= 4 else 300),
                   "offense_lineup": sorted(lineups[tid]) if lineups else None,
                   "defense_lineup": sorted(lineups[other[tid]]) if lineups else None,
                   "score_margin": score[tid] - score[other[tid]], **dict.fromkeys(COUNTS, 0), "events": []}

    def log(kind, event, seconds, **fields):
        # Supplementary events (assist, steal) can follow the event that closed the possession.
        target = current or (possessions[-1] if possessions else None)
        if target is not None:
            target["events"].append({"type": kind, "team": event.get("entityId"), "player": event.get("personId"),
                                     "clock": seconds, **fields})

    def ensure(tid, seconds, lineups, event):
        if current and current["offense"] == tid:
            return
        if current:
            # The ball changed hands without an ending event: a foul by the
            # offense, or a source omission that is reported, never hidden.
            fouled_by_offense = last_foul and last_foul[0] == current["offense"]
            if not fouled_by_offense:
                unrecorded.append({"event_id": event.get("eventId"), "period": period, "clock": event.get("clock")})
            close("offensive_foul" if fouled_by_offense else "unrecorded", seconds)
        open_for(tid, lineups)

    def finish_period():
        previous = possessions[-1] if possessions and possessions[-1]["period"] == period else None
        if (current is None and previous and previous["end_clock"] > 0
                and previous["end"] in ("made_fg", "made_ft", "turnover", "offensive_foul")):
            # The other team held the ball until the buzzer without a recorded event.
            open_for(other[previous["offense"]], last_lineups)
        if current:
            close("period_end", 0)

    last_lineups = None
    for event_period, event, seconds, lineups in events:
        if event_period != period:
            finish_period()
            period, last_foul = event_period, None
        last_lineups = lineups or last_lineups
        kind, subtype, tid = event.get("eventType"), event.get("eventSubType"), event.get("entityId")
        if kind == "foul":
            if subtype != "drawn":
                last_foul = (tid, subtype)
                log("foul", event, seconds, subtype=subtype)
            continue
        if kind == "steal":
            steals.add((period, seconds, tid))
            log("steal", event, seconds)
            continue
        if kind == "jumpBall":
            if subtype == "won" and current and current["offense"] != tid:
                close("jump_ball", seconds)
            continue
        if kind in ("assist", "block"):
            log(kind, event, seconds)
            continue
        if lineups is None:
            continue
        made = event.get("success") is True
        if kind == "freeThrow":
            if last_foul and last_foul[1] in TECHNICAL_FOULS and last_foul[0] == other[tid]:
                outside_points[tid] += made
                score[tid] += made
                continue
            previous = possessions[-1] if possessions else None
            if (current is None and previous and previous["offense"] == tid and previous["period"] == period
                    and previous["end"] == "made_fg" and previous["end_clock"] == seconds):
                current = possessions.pop()  # And-one: the free throw continues the scoring possession.
            ensure(tid, seconds, lineups, event)
            log("free_throw", event, seconds, made=made, subtype=subtype)
            current["fta"] += 1
            current["points"] += made
            score[tid] += made
            if made and last_free_throw(subtype) and not (last_foul and last_foul[1] in RETAINED_BALL_FOULS):
                close("made_ft", seconds)
        elif kind in ("2pt", "3pt"):
            ensure(tid, seconds, lineups, event)
            log(kind, event, seconds, made=made, x=event.get("x"), y=event.get("y"))
            current["fga"] += 1
            current["three_pa"] += kind == "3pt"
            if made:
                points = 3 if kind == "3pt" else 2
                current["points"] += points
                score[tid] += points
                close("made_fg", seconds)
        elif kind == "turnover":
            ensure(tid, seconds, lineups, event)
            log("turnover", event, seconds, subtype=subtype)
            current["turnovers"] += 1
            close("turnover", seconds)
        elif kind == "rebound" and subtype == "offensive":
            ensure(tid, seconds, lineups, event)
            log("offensive_rebound", event, seconds)
            current["offensive_rebounds"] += 1
        elif kind == "rebound":
            if current and current["offense"] == other[tid]:
                log("defensive_rebound", event, seconds)
                close("defensive_rebound", seconds)
            elif not (current and current["offense"] == tid):
                log("defensive_rebound", event, seconds)
            if not (current and current["offense"] == tid):
                ensure(tid, seconds, lineups, event)
                current["start"] = "defensive_rebound"
    finish_period()

    for previous, possession in zip(possessions, possessions[1:]):
        if possession["start"] == "turnover" and (previous["period"], previous["end_clock"], possession["offense"]) in steals:
            possession["start"] = "steal"
    for possession in possessions:
        possession["seconds"] = round(possession["start_clock"] - possession["end_clock"], 1)

    box = {t["source_id"]: t["stats"] for t in record["teams"]}
    checks = {}
    for tid in teams:
        own = [p for p in possessions if p["offense"] == tid]
        points = sum(p["points"] for p in own) + outside_points[tid]
        if points != box[tid]["points"]:
            raise ValueError("Possession points differ from box score")
        stats = box[tid]
        estimate = stats["two_pa"] + stats["three_pa"] - stats["offensive_rebounds"] + stats["turnovers"] + 0.44 * stats["fta"]
        checks[tid] = {"possessions": len(own), "box_score_estimate": round(estimate, 1),
                       "points_outside_possessions": outside_points[tid]}
    difference = abs(checks[teams[0]]["possessions"] - checks[teams[1]]["possessions"])
    # Possession alternates, so each period can add at most one surplus possession.
    if difference > len({p["period"] for p in possessions}):
        raise ValueError("Teams' possession counts do not alternate")
    diagnostics.update({"teams": checks, "unrecorded_changes": unrecorded})
    return possessions


def lineup_totals(games):
    """Aggregate offense and defense per five-player unit; time is approximate."""
    units = {}
    for game in games:
        for p in game["possessions"]:
            if p["offense_lineup"] is None:
                continue
            for side, tid, lineup in (("offense", p["offense"], p["offense_lineup"]), ("defense", p["defense"], p["defense_lineup"])):
                unit = units.setdefault((tid, tuple(lineup)), {"team_id": tid, "players": list(lineup), "games": set(),
                    "seconds": 0, "offense": {"possessions": 0, "points": 0}, "defense": {"possessions": 0, "points": 0}})
                unit["games"].add(game["match_id"])
                unit["seconds"] += p["seconds"]
                unit[side]["possessions"] += 1
                unit[side]["points"] += p["points"]
    result = []
    for unit in units.values():
        unit["games"] = len(unit["games"])
        unit["seconds"] = round(unit["seconds"], 1)
        result.append(unit)
    return sorted(result, key=lambda u: -(u["offense"]["possessions"] + u["defense"]["possessions"]))
