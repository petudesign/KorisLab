"""Link recorded assists to made field goals without guessing from player names."""
from collections import Counter

from normalization.basketfi_pbp import normalize_quarter_stats, play_by_play_periods


def normalize_assists(payload, record, *, fixture_id):
    # Reuse fixture/team, event uniqueness, completed-period and score checks.
    normalize_quarter_stats(payload, record, fixture_id=fixture_id)
    players = {}
    counts = Counter()
    for team in record["teams"]:
        for player in team["players"]:
            key = (team["source_id"], player["source_player_id"])
            if key in players:
                raise ValueError("Duplicate player in box score")
            players[key] = {"id": key[1], "team_id": key[0], "name": player["display_name"],
                "games": int((player.get("minutes") or 0) > 0), "assists": 0,
                "two": 0, "three": 0, "free_throw": 0, "unlinked": 0}
    used_shots = set()
    for period in play_by_play_periods(payload).values():
        events = period["events"]
        for index, event in enumerate(events):
            if event.get("eventType") != "assist":
                continue
            key = (event.get("entityId"), event.get("personId"))
            if key not in players or not players[key]["games"]:
                raise ValueError("Assist has no participating box-score player")
            row = players[key]
            row["assists"] += 1
            counts[key] += 1
            clock = event.get("clock")
            previous = events[index - 1] if index else {}
            # The source also records assists after free throws. Keep these separate;
            # they are not two-/three-point baskets and do not enter field-goal points.
            if clock and previous.get("eventType") == "freeThrow" and previous.get("clock") == clock and previous.get("entityId") == key[0]:
                row["free_throw"] += 1
                continue
            candidates = [shot for shot in events if clock and shot.get("clock") == clock
                and shot.get("entityId") == key[0] and shot.get("eventType") in {"2pt", "3pt"}
                and shot.get("success") is True]
            if len(candidates) > 1 and isinstance(event.get("scores"), dict):
                candidates = [shot for shot in candidates if shot.get("scores") == event["scores"]]
            # Some source assists appear before the basket. Same period + clock + team
            # plus the score when clocks repeat must identify exactly one made shot.
            # Ambiguous events remain unlinked.
            if len(candidates) == 1 and candidates[0]["eventId"] not in used_shots and candidates[0].get("personId") != key[1]:
                shot = candidates[0]
                used_shots.add(shot["eventId"])
                row["two" if shot["eventType"] == "2pt" else "three"] += 1
            else:
                row["unlinked"] += 1
    for team in record["teams"]:
        if sum(counts[(team["source_id"], p["source_player_id"])] for p in team["players"]) != team["stats"].get("assists"):
            raise ValueError("Play-by-play team assists differ from box score")
        for player in team["players"]:
            key = (team["source_id"], player["source_player_id"])
            expected = player["stats"].get("assists")
            if (expected is None and players[key]["games"]) or (expected is not None and counts[key] != expected):
                raise ValueError("Play-by-play player assists differ from box score")
    return [row for row in players.values() if row["games"]]
