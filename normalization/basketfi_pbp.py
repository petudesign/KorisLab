"""Count quarter-level questions from completed, box-score-checked events."""

METRICS = ("steals", "fta", "three_pa", "turnovers", "points")


def fixture_data(payload):
    data = payload.get("data", {})
    fixture = data.get("banner", {}).get("fixture") or data.get("fixture", {})
    return fixture if isinstance(fixture, dict) else {}


def play_by_play_periods(payload):
    """Return period data keyed by period ID for both Basket.fi response shapes."""
    data = payload.get("data", {})
    periods = data.get("pbp")
    if isinstance(periods, dict):
        return periods

    # Sportradar moved event data from `pbp` into a periodData array. Keep the
    # source period IDs (including 11+ overtime IDs) when adapting it.
    period_data = data.get("periodData")
    if isinstance(period_data, dict):
        return period_data
    if isinstance(period_data, list):
        result = {}
        for period in period_data:
            if not isinstance(period, dict):
                continue
            period_id = period.get("periodId")
            if isinstance(period_id, int) and not isinstance(period_id, bool):
                key = str(period_id)
            elif isinstance(period_id, str) and period_id.isdigit():
                key = str(int(period_id))
            else:
                continue
            if key in result:
                raise ValueError("Duplicate play-by-play period")
            result[key] = period
        return result
    return None


def period_number(value):
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def normalize_quarter_stats(payload, record, *, fixture_id):
    fixture = fixture_data(payload)
    if str(fixture.get("id") or fixture.get("fixtureId")) != str(fixture_id):
        raise ValueError("Play-by-play fixture differs from requested fixture")
    teams = record["teams"]
    team_ids = {team["source_id"] for team in teams}
    if len(team_ids) != 2 or team_ids != {team["entityId"] for team in fixture.get("competitors", [])}:
        raise ValueError("Play-by-play teams differ from box score")
    periods = play_by_play_periods(payload)
    if not isinstance(periods, dict) or not all(str(n) in periods for n in range(1, 5)):
        raise ValueError("Four completed quarters are required")
    counts = {}
    seen = set()
    for key, period in periods.items():
        if not str(key).isdigit() or int(key) < 1 or period.get("ended") is not True or not isinstance(period.get("events"), list):
            raise ValueError("Incomplete play-by-play period")
        counts[key] = {team_id: dict.fromkeys(METRICS, 0) for team_id in team_ids}
        for event in period["events"]:
            event_id = event.get("eventId")
            if not event_id or event_id in seen or period_number(event.get("periodId")) != int(key):
                raise ValueError("Invalid, duplicate or misplaced play-by-play event")
            seen.add(event_id)
            kind = event.get("eventType")
            metric = {"steal": "steals", "turnover": "turnovers", "3pt": "three_pa", "freeThrow": "fta"}.get(kind)
            if not metric and kind != "2pt":
                continue
            team_id = event.get("entityId")
            if team_id not in team_ids:
                raise ValueError("Statistical event has no known team")
            row = counts[key][team_id]
            if metric:
                row[metric] += 1
            if kind in {"2pt", "3pt", "freeThrow"}:
                if not isinstance(event.get("success"), bool):
                    raise ValueError("Shot outcome unavailable")
                if event["success"]:
                    row["points"] += {"2pt": 2, "3pt": 3, "freeThrow": 1}[kind]
    if not seen:
        raise ValueError("Empty play-by-play")
    # Period IDs use 11+ for overtime. Match them in order, without folding OT into Q4.
    ordered_periods = sorted(counts, key=int)
    box_periods = record["game"]["periods"]
    if len(ordered_periods) != len(box_periods):
        raise ValueError("Play-by-play period coverage differs from box score")
    for key, box in zip(ordered_periods, box_periods):
        for team in teams:
            expected = box["home_score" if team["home_away"] == "home" else "away_score"]
            if counts[key][team["source_id"]]["points"] != expected:
                raise ValueError("Play-by-play quarter points differ from box score")
    verified = [metric for metric in METRICS if all(
        team["stats"].get(metric) is not None and
        sum(counts[key][team["source_id"]][metric] for key in counts) == team["stats"][metric]
        for team in teams)]
    if "points" not in verified:
        raise ValueError("Play-by-play points differ from box score")
    return {"match_id": record["game"]["source_id"], "verified_metrics": verified,
            "event_count": len(seen), "periods": counts}
