"""Publish a chronological score replay only after reconciling every period."""
from normalization.basketfi_pbp import fixture_data, normalize_quarter_stats, play_by_play_periods
from normalization.basketfi_onoff import clock_seconds


def normalize_replay(payload, record, *, season_id):
    fixture = fixture_data(payload)
    fixture_id = fixture.get("id") or fixture.get("fixtureId")
    verified = normalize_quarter_stats(payload, record, fixture_id=fixture_id)
    teams = sorted(record["teams"], key=lambda team: team["home_away"] != "home")
    score = dict.fromkeys([team["source_id"] for team in teams], 0)
    events = [{"id": "start", "elapsed": 0, "period": 1, "remaining": 600,
               "kind": "start", "team_id": None, "player": None, "points": 0, "home": 0, "away": 0}]
    periods = []
    offset = 0
    periods_data = play_by_play_periods(payload)
    for number, (key, period) in enumerate(sorted(periods_data.items(), key=lambda item: int(item[0])), 1):
        duration = 600 if number <= 4 else 300
        previous = duration
        periods.append({"number": number, "start": offset, "end": offset + duration})
        # Corrections can be appended out of order in the source. Order by game
        # clock, preserving source order for events sharing the same timestamp.
        clocks = [(clock_seconds(event.get("clock")), event) for event in period["events"]]
        if any(clock is None or not 0 <= clock <= duration for clock, _ in clocks):
            raise ValueError("Invalid game clock")
        for remaining, event in sorted(clocks, key=lambda item: -item[0]):
            if remaining is None or not 0 <= remaining <= previous:
                raise ValueError("Invalid or nonchronological game clock")
            previous = remaining
            kind = event.get("eventType")
            points = {"2pt": 2, "3pt": 3, "freeThrow": 1}.get(kind, 0) if event.get("success") is True else 0
            if points:
                score[event["entityId"]] += points
            events.append({"id": event["eventId"], "elapsed": offset + duration - remaining,
                           "period": number, "remaining": remaining, "kind": kind,
                           "subtype": event.get("eventSubType"), "made": event.get("success"),
                           "team_id": event.get("entityId"), "player": event.get("name"),
                           "points": points, "home": score[teams[0]["source_id"]], "away": score[teams[1]["source_id"]]})
        offset += duration
        events.append({"id": f"end-{number}", "elapsed": offset, "period": number, "remaining": 0,
                       "kind": "periodEnd", "team_id": None, "player": None, "points": 0,
                       "home": score[teams[0]["source_id"]], "away": score[teams[1]["source_id"]]})
    if any(score[team["source_id"]] != team["score"] for team in teams):
        raise ValueError("Replay final score differs from box score")
    return {"schema_version": "0.1", "match_id": str(record["game"]["source_id"]),
            "season_id": season_id, "verified": True, "event_count": verified["event_count"],
            "duration": offset, "teams": [{"id": team["source_id"], "name": team["name"], "home": team["home_away"] == "home"} for team in teams],
            "periods": periods, "events": events}
