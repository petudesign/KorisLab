"""Reconstruct only complete, box-score-reconciled five-player lineups."""
from collections import defaultdict
from math import isfinite
import re

STATS = ("points", "two_pm", "two_pa", "three_pm", "three_pa", "ftm", "fta",
         "offensive_rebounds", "defensive_rebounds", "rebounds", "assists", "turnovers", "steals", "blocks")
PLAYING_TIME_TOLERANCE_SECONDS = 30
OPTIONAL_STATS = {"defensive_rebounds", "rebounds", "assists", "steals", "blocks"}


def empty_state():
    return {"seconds": 0, "own": dict.fromkeys(STATS, 0), "opponent": dict.fromkeys(STATS, 0)}


def clock_seconds(clock):
    match = re.fullmatch(r"PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?", str(clock))
    if not match or not any(match.groups()):
        raise ValueError("Invalid event clock")
    return int(match[1] or 0) * 60 + float(match[2] or 0)


def reconstruct_game(payload, record, *, playing_time_tolerance_seconds=PLAYING_TIME_TOLERANCE_SECONDS, diagnostics=None):
    if not isfinite(playing_time_tolerance_seconds) or playing_time_tolerance_seconds < 0:
        raise ValueError("Invalid playing-time tolerance")
    diagnostics = diagnostics if diagnostics is not None else {}
    diagnostics.update({"same_clock_events": [], "playing_time_differences": [], "unavailable_stats": []})
    unavailable_stats = set()
    teams = {t["source_id"]: t for t in record["teams"]}
    fixture = payload.get("data", {}).get("banner", {}).get("fixture", {})
    if len(teams) != 2 or {t["entityId"] for t in fixture.get("competitors", [])} != set(teams):
        raise ValueError("Event teams differ from box score")
    roster = {tid: {p["source_player_id"]: p for p in t["players"]} for tid, t in teams.items()}
    lineups = {tid: {pid for pid, p in players.items() if p.get("starter") is True} for tid, players in roster.items()}
    if any(len(players) != 5 for players in lineups.values()):
        raise ValueError("Five starters are required for both teams")
    states = {tid: {pid: {"on": empty_state(), "off": empty_state()} for pid in players} for tid, players in roster.items()}
    periods = payload.get("data", {}).get("pbp", {})
    keys = sorted(periods, key=int)
    if keys[:4] != ["1", "2", "3", "4"] or len(keys) != len(record["game"]["periods"]):
        raise ValueError("Incomplete periods")
    seen = set()
    totals = {tid: dict.fromkeys(STATS, 0) for tid in teams}
    total_seconds = 0

    def require_lineups():
        if any(len(players) != 5 for players in lineups.values()):
            raise ValueError("Incomplete lineup at a timed or statistical event")

    def advance(seconds):
        if seconds <= 0:
            return
        require_lineups()
        for tid, players in states.items():
            for pid, pair in players.items():
                pair["on" if pid in lineups[tid] else "off"]["seconds"] += seconds

    for key in keys:
        period = periods[key]
        if period.get("ended") is not True:
            raise ValueError("Unfinished period")
        duration = 600 if int(key) <= 4 else 300
        total_seconds += duration
        previous = duration
        clock_lineups = []
        snapshot_clock = None

        def remember_lineup():
            if all(len(players) == 5 for players in lineups.values()):
                snapshot = {tid: frozenset(players) for tid, players in lineups.items()}
                if snapshot not in clock_lineups:
                    clock_lineups.append(snapshot)

        # Stable sorting retains the source event order at identical clocks.
        for event in sorted(period["events"], key=lambda e: -clock_seconds(e.get("clock"))):
            event_id = event.get("eventId")
            if not event_id or event_id in seen or event.get("periodId") != int(key):
                raise ValueError("Duplicate or misplaced event")
            seen.add(event_id)
            seconds = clock_seconds(event.get("clock"))
            if not 0 <= seconds <= previous:
                raise ValueError("Clock outside period")
            advance(previous - seconds)
            previous = seconds
            if snapshot_clock != seconds:
                snapshot_clock = seconds
                clock_lineups.clear()
                remember_lineup()
            tid, pid = event.get("entityId"), event.get("personId")
            kind = event.get("eventType")
            if kind == "substitution":
                if tid not in roster or pid not in roster[tid]:
                    raise ValueError("Unknown substitution player")
                action = event.get("eventSubType")
                if action == "out" and pid in lineups[tid]:
                    lineups[tid].remove(pid)
                elif action == "in" and pid not in lineups[tid]:
                    lineups[tid].add(pid)
                else:
                    raise ValueError("Substitution conflicts with lineup")
                remember_lineup()
                continue
            increments = defaultdict(int)
            if kind in ("2pt", "3pt", "freeThrow"):
                if not isinstance(event.get("success"), bool):
                    raise ValueError("Missing shot result")
                made = int(event["success"])
                prefix, points = {"2pt": ("two", 2), "3pt": ("three", 3), "freeThrow": ("ft", 1)}[kind]
                increments[{"two": "two_pa", "three": "three_pa", "ft": "fta"}[prefix]] = 1
                increments[{"two": "two_pm", "three": "three_pm", "ft": "ftm"}[prefix]] = made
                increments["points"] = made * points
            elif kind == "rebound":
                subtype = event.get("eventSubType")
                if subtype not in ("offensive", "defensive"):
                    raise ValueError("Unknown rebound type")
                increments[f"{subtype}_rebounds"] = 1
                increments["rebounds"] = 1
            elif kind in ("assist", "turnover", "steal", "block"):
                increments[{"assist": "assists", "turnover": "turnovers", "steal": "steals", "block": "blocks"}[kind]] = 1
            else:
                continue
            require_lineups()
            if tid not in teams:
                raise ValueError("Unknown statistical team")
            event_lineups = lineups
            if pid and pid not in lineups[tid]:
                if pid not in roster[tid]:
                    raise ValueError("Unknown statistical player")
                # A supplementary event can be listed after a same-clock swap.
                # Keep swap order intact (especially between free throws). Use an
                # earlier complete lineup only when it identifies one unique state.
                candidates = [snapshot for snapshot in clock_lineups if pid in snapshot[tid]]
                if len(candidates) == 1:
                    event_lineups = candidates[0]
                    diagnostics["same_clock_events"].append({"event_id": event_id, "period": int(key),
                        "clock": event.get("clock"), "event_type": kind})
                elif set(increments) <= OPTIONAL_STATS:
                    # Ambiguous auxiliary stats must not invalidate otherwise
                    # reconciled scoring, but cannot be allocated to on/off stints.
                    unavailable_stats.update(increments)
                else:
                    raise ValueError("Statistical player is not on court; same-clock lineup is unresolved")
            for stat, value in increments.items():
                totals[tid][stat] += value
                for player_team, players in states.items():
                    for player_id, pair in players.items():
                        state = pair["on" if player_id in event_lineups[player_team] else "off"]
                        state["own" if tid == player_team else "opponent"][stat] += value
        advance(previous)
    for tid, players in roster.items():
        # Shooting, possessions and score are necessary for rating estimates.
        for stat in ("points", "two_pm", "two_pa", "three_pm", "three_pa", "ftm", "fta", "offensive_rebounds", "turnovers"):
            if teams[tid]["stats"].get(stat) != totals[tid][stat]:
                raise ValueError(f"Event {stat} differs from box score")
        for pid, player in players.items():
            on = states[tid][pid]["on"]
            minutes = player.get("minutes")
            if minutes is None and player.get("participated") is not False:
                raise ValueError("Unknown player participation or playing time")
            # Box-score minutes are stored as rounded decimal minutes.
            expected_seconds = round((minutes or 0) * 60, 2)
            difference = round(abs(on["seconds"] - expected_seconds), 2)
            if difference > playing_time_tolerance_seconds:
                raise ValueError("Reconstructed playing time differs from box score")
            if difference > 2:
                diagnostics["playing_time_differences"].append({"team_id": tid, "player_id": pid,
                    "reconstructed_seconds": on["seconds"], "box_score_seconds": expected_seconds,
                    "difference_seconds": difference})
            plus_minus = player["stats"].get("plus_minus")
            if plus_minus is not None and on["own"]["points"] - on["opponent"]["points"] != plus_minus:
                raise ValueError("Reconstructed plus/minus differs from box score")
            # Null and mismatching optional fields remain unavailable, never zero.
            for stat in STATS:
                if stat in unavailable_stats or teams[tid]["stats"].get(stat) != totals[tid][stat]:
                    unavailable_stats.add(stat)
                    for pair in states[tid].values():
                        pair["on"]["own"][stat] = pair["off"]["own"][stat] = None
                    other = next(t for t in teams if t != tid)
                    for pair in states[other].values():
                        pair["on"]["opponent"][stat] = pair["off"]["opponent"][stat] = None
    diagnostics["unavailable_stats"] = sorted(unavailable_stats)
    return states, totals, total_seconds
