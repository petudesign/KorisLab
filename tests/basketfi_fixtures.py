"""Small source-shaped Basket.fi fixtures for both Sportradar response layouts."""
from copy import deepcopy


HOME = "home-team"
AWAY = "away-team"
FIXTURE_ID = "fixture-2026"


def _event(event_id, period, team, kind, clock, *, made=True):
    return {
        "eventId": event_id,
        "periodId": period,
        "entityId": team,
        "eventType": kind,
        "eventSubType": "jumpShot" if kind in {"2pt", "3pt"} else None,
        "success": made,
        "clock": clock,
        "personId": f"{team}-player",
        "name": "Test Player",
    }


def basketfi_payload(schema="current"):
    """Build a compact four-period response with 8–6 final score."""
    period_events = {
        1: [_event("h-q1", 1, HOME, "2pt", "PT09M00S"), _event("a-q1", 1, AWAY, "2pt", "PT08M00S")],
        2: [_event("h-q2", 2, HOME, "2pt", "PT09M00S"), _event("a-q2", 2, AWAY, "2pt", "PT08M00S")],
        3: [_event("h-q3", 3, HOME, "3pt", "PT09M00S")],
        4: [_event("h-q4-ft", 4, HOME, "freeThrow", "PT09M00S"), _event("a-q4", 4, AWAY, "2pt", "PT08M00S")],
    }
    period_scores = {1: (2, 2), 2: (2, 2), 3: (3, 0), 4: (1, 2)}
    shots_by_period = {
        period: [event for event in events if event["eventType"] in {"2pt", "3pt"}]
        for period, events in period_events.items()
    }
    for shots in shots_by_period.values():
        for shot in shots:
            shot["x"], shot["y"] = 40, 82

    competitors = [
        {"entityId": HOME, "isHome": True, "name": "Home", "score": "8"},
        {"entityId": AWAY, "isHome": False, "name": "Away", "score": "6"},
    ]
    fixture = {
        "id": FIXTURE_ID,
        "startDateTime": "2026-10-06T18:30:00",
        "status": "FINISHED",
        "venue": "Test Arena",
        "competitors": competitors,
    }

    def team_stats(points, two_made, three_made, ft_made):
        return {
            "entity": {
                "points": points,
                "pointsTwoMade": two_made,
                "pointsTwoAttempted": two_made,
                "pointsTwoPercentage": 100 if two_made else 0,
                "pointsThreeMade": three_made,
                "pointsThreeAttempted": three_made,
                "pointsThreePercentage": 100 if three_made else 0,
                "freeThrowsMade": ft_made,
                "freeThrowsAttempted": ft_made,
                "freeThrowsPercentage": 100 if ft_made else 0,
                "reboundsOffensive": 1,
                "reboundsDefensive": 1,
                "rebounds": 2,
                "assists": 0,
                "turnovers": 0,
                "steals": 0,
                "blocks": 0,
                "blocksReceived": 0,
                "foulsTotal": 0,
                "foulsDrawn": 0,
                "plusMinus": None,
                "efficiency": points,
            },
            "extra": {},
            "persons": [],
        }

    data = {
        "banner": {
            "competition": {"id": "test-league", "name": "Test League"},
            "season": {"id": "test-season", "name": "2026–27"},
            "fixture": deepcopy(fixture),
        },
        "fixture": deepcopy(fixture),
        "statistics": {"advancedStatsEnabled": False, "data": {"base": {
            "home": team_stats(8, 2, 1, 1),
            "away": team_stats(6, 3, 0, 0),
        }}},
        "shotChart": {},
    }
    if schema == "current":
        data["periodData"] = [
            {
                "periodId": period,
                "ended": True,
                "teamScore": {HOME: str(score[0]), AWAY: str(score[1])},
                "events": deepcopy(period_events[period]),
                "shots": deepcopy(shots_by_period[period]),
            }
            for period, score in period_scores.items()
        ]
    elif schema == "legacy":
        data["banner"]["fixture"]["periodData"] = {"teamScores": {
            HOME: [{"periodId": period, "score": score[0]} for period, score in period_scores.items()],
            AWAY: [{"periodId": period, "score": score[1]} for period, score in period_scores.items()],
        }}
        data["shotChart"]["shots"] = [shot for rows in shots_by_period.values() for shot in rows]
        data["pbp"] = {
            str(period): {"ended": True, "events": deepcopy(period_events[period])}
            for period in period_events
        }
    else:
        raise ValueError(f"Unknown fixture schema: {schema}")
    return {"data": data}
