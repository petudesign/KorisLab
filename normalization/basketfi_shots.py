"""Normalize Basket.fi's public shot chart without guessing player identities."""
from datetime import datetime, timezone
from math import isfinite


def normalize_shot_chart(payload, *, match_id, fixture_id):
    data = payload.get("data", {})
    fixture = data.get("banner", {}).get("fixture") or data.get("fixture", {})
    if str(fixture.get("id") or fixture.get("fixtureId")) != str(fixture_id):
        raise ValueError("Shot chart fixture differs from requested fixture")
    chart = data.get("shotChart")
    if not isinstance(chart, dict) or not isinstance(chart.get("shots"), list):
        raise ValueError("No shot chart in source response")
    teams = [{"id": row["entityId"], "name": row["name"], "home": row.get("isHome") is True}
             for row in fixture.get("competitors", [])]
    team_ids = {team["id"] for team in teams}
    if len(team_ids) != 2:
        raise ValueError("Shot chart must identify two teams")
    shots = []
    seen = set()
    for row in chart["shots"]:
        if row.get("eventType") not in {"2pt", "3pt"}:
            continue  # Free throws have no field-goal location.
        shot_id = row.get("eventId")
        if not shot_id or shot_id in seen or row.get("entityId") not in team_ids:
            raise ValueError("Invalid or duplicate shot identity")
        if not isinstance(row.get("success"), bool):
            raise ValueError("Shot outcome unavailable")
        period = row.get("periodId")
        if not isinstance(period, int) or isinstance(period, bool) or period < 1:
            raise ValueError("Shot period unavailable")
        seen.add(shot_id)
        def coordinate(key):
            value = row.get(key)
            return value if isinstance(value, (float, int)) and not isinstance(value, bool) and isfinite(value) and 0 <= value <= 100 else None
        shots.append({"id": shot_id, "team_id": row["entityId"],
                      "player_id": row.get("personId"), "player_name": row.get("name"),
                      "period": period, "clock": row.get("clock"),
                      "points": 3 if row["eventType"] == "3pt" else 2,
                      "made": row["success"], "type": row.get("subType"),
                      "x": coordinate("x"), "y": coordinate("y")})
    return {"schema_version": "0.1", "match_id": str(match_id),
            "fixture_id": str(fixture_id), "coordinate_system": "full_court_percent",
            "source_url": f"https://tulospalvelu.basket.fi/match/{match_id}/shot_chart",
            "updated_at": datetime.now(timezone.utc).isoformat(), "teams": teams, "shots": shots}
