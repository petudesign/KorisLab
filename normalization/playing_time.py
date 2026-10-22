"""Recover legacy minute-as-second imports from fully reconciled event clocks.

The rounded values identify a broken import; they are never published as the
repair. Actual seconds come from substitutions, validated by the existing strict
lineup/score/plus-minus reconstruction.
"""
from copy import deepcopy
from hashlib import sha256
from itertools import combinations
import json

from normalization.basketfi_onoff import reconstruct_game
from normalization.basketfi_pbp import fixture_data


def minute_unit_candidates(record):
    periods = record.get("game", {}).get("periods") or []
    if len(periods) < 4:
        return {}
    expected = 5 * (40 + 5 * (len(periods) - 4))
    result = {}
    for team in record.get("teams", []):
        players = team.get("players", [])
        values = [p.get("minutes") for p in players]
        if len(values) < 5 or any(v is None or v < 0 for v in values):
            continue
        # Legacy imports put rounded whole minutes into the seconds component.
        candidates = [p for p in players if 0 < p["minutes"] < 1 and abs(p["minutes"] * 60 - round(p["minutes"] * 60)) < .01]
        deficit = expected - sum(values)
        if deficit < 2 or not candidates or len(candidates) > 15:
            continue
        solutions = []
        for size in range(1, len(candidates) + 1):
            for subset in combinations(candidates, size):
                restored = sum(round(p["minutes"] * 60) - p["minutes"] for p in subset)
                if abs(restored - deficit) <= size * .5 + .02:
                    solutions.append([p["source_player_id"] for p in subset])
        # Ambiguous unit assignments are never guessed. Strict event replay must
        # still validate this hypothesis before any replacement is published.
        if len(solutions) == 1:
            result[team["source_id"]] = solutions[0]
    return result


def legacy_minute_teams(record):
    return list(minute_unit_candidates(record))


def recover_legacy_minutes(record, payload, *, fixture_id=None):
    """Mutate only after every reconstruction check succeeds; fail closed."""
    affected = minute_unit_candidates(record)
    if not affected:
        return False
    fixture = fixture_data(payload)
    if fixture_id is not None and str(fixture.get("id") or fixture.get("fixtureId")) != str(fixture_id):
        raise ValueError("Playing-time recovery fixture differs from requested fixture")
    candidate = deepcopy(record)
    for team in candidate["teams"]:
        if team["source_id"] in affected:
            for player in team["players"]:
                if player["source_player_id"] in affected[team["source_id"]]:
                    player["minutes"] = round(player["minutes"] * 60)
    states, _, seconds = reconstruct_game(payload, candidate)
    for team in candidate["teams"]:
        total = sum(s["on"]["seconds"] for s in states[team["source_id"]].values())
        if total != seconds * 5:
            raise ValueError("Reconstructed team playing time differs from five-player game duration")
    for team in record["teams"]:
        if team["source_id"] not in affected:
            continue
        for player in team["players"]:
            if player["source_player_id"] not in affected[team["source_id"]]:
                continue
            original = {"minutes": player["minutes"], "minutes_display": player.get("minutes_display")}
            elapsed = round(states[team["source_id"]][player["source_player_id"]]["on"]["seconds"])
            player.setdefault("source_fields", {})["original_playing_time"] = original
            player["minutes"] = round(elapsed / 60, 4)
            player["minutes_display"] = f"{elapsed // 60}:{elapsed % 60:02d}"
    record.setdefault("source", {})["playing_time_recovery"] = {
        "method": "validated_substitution_clocks_v1",
        "fixture_id": fixture.get("id") or fixture.get("fixtureId"),
        "payload_sha256": sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest(),
        "team_ids": list(affected),
    }
    return True


def quarantine_legacy_minutes(record, reason):
    """Keep valid counting stats/participation, withhold unverified playing time."""
    affected = minute_unit_candidates(record)
    for team in record["teams"]:
        if team["source_id"] not in affected:
            continue
        for player in team["players"]:
            if player["source_player_id"] not in affected[team["source_id"]]:
                continue
            player.setdefault("source_fields", {})["original_playing_time"] = {
                "minutes": player["minutes"], "minutes_display": player.get("minutes_display")}
            player["participated"] = True
            player["minutes"] = None
            player["minutes_display"] = None
    record.setdefault("availability", {})["playing_time"] = False
    record.setdefault("source", {})["playing_time_unavailable"] = {"reason": reason, "team_ids": list(affected)}
