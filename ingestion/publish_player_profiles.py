"""Publish season-specific player bio fields from Basket.fi team rosters."""

from __future__ import annotations

from datetime import date, datetime, timezone
import json
from pathlib import Path
import re
import time
import unicodedata
from typing import Any

from ingestion.basketfi import BasketFiClient


ROOT = Path(__file__).resolve().parents[1]
SEASONS = (
    {
        "league_id": "naisten-korisliiga", "season_id": "2024-25",
        "competition_id": "2024-2025", "category_id": "1",
        "stats": ["data/normalized/season_2024_2025.json", "data/normalized/season_playoffs_2024_2025.json"],
        "asset_prefix": "",
    },
    {
        "league_id": "naisten-korisliiga", "season_id": "2025-26",
        "competition_id": "huki2526", "category_id": "1",
        "stats": ["data/normalized/season_verified.json", "data/normalized/season_playoffs_2025_2026.json"],
        "asset_prefix": "",
    },
    {
        "league_id": "naisten-korisliiga", "season_id": "2026-27",
        "competition_id": "huki2627", "category_id": "1",
        "stats": ["web/public/season-2026-27.json"],
        "asset_prefix": "",
    },
    {
        "league_id": "korisliiga", "season_id": "2024-25",
        "competition_id": "2024-2025", "category_id": "4",
        "stats": ["data/normalized/season_korisliiga_2024_2025.json", "data/normalized/season_korisliiga_playoffs_2024_2025.json"],
        "asset_prefix": "korisliiga",
    },
    {
        "league_id": "korisliiga", "season_id": "2025-26",
        "competition_id": "huki2526", "category_id": "4",
        "stats": ["data/normalized/season_korisliiga_2025_2026.json", "data/normalized/season_korisliiga_playoffs_2025_2026.json"],
        "asset_prefix": "korisliiga",
    },
    {
        "league_id": "korisliiga", "season_id": "2026-27",
        "competition_id": "huki2627", "category_id": "4",
        "stats": ["web/public/korisliiga/season-2026-27.json"],
        "asset_prefix": "korisliiga",
    },
)

POSITION_FI = {
    "taka": "Takapelaaja", "guard": "Takapelaaja", "pointguard": "Takapelaaja",
    "pg": "Pelintekijä", "sg": "Heittävä takapelaaja", "comboguard": "Takapelaaja",
    "laita": "Laitahyökkääjä", "wing": "Laitahyökkääjä", "forward": "Laitahyökkääjä",
    "sf": "Pieni laitahyökkääjä", "pf": "Iso laitahyökkääjä",
    "sentteri": "Sentteri", "center": "Sentteri", "centre": "Sentteri", "c": "Sentteri",
}
POSITION_EN = {
    "taka": "Guard", "guard": "Guard", "pointguard": "Point guard", "pg": "Point guard",
    "sg": "Shooting guard", "comboguard": "Guard", "takapelaaja": "Guard",
    "laitahyokkaaja": "Forward", "laita": "Forward", "wing": "Forward",
    "forward": "Forward", "sf": "Small forward", "pf": "Power forward",
    "sentteri": "Center", "center": "Center", "centre": "Center", "c": "Center",
}
def canonical(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char)).lower()
    return "".join(char for char in text if char.isalnum())


def text(value: Any) -> str | None:
    cleaned = str(value or "").strip()
    return cleaned or None


def date_value(value: Any) -> datetime | None:
    raw = text(value)
    if not raw or raw.startswith("0000-00-00"):
        return None
    try:
        return datetime.fromisoformat(raw[:19].replace("T", " "))
    except ValueError:
        try:
            return datetime.combine(date.fromisoformat(raw[:10]), datetime.min.time())
        except ValueError:
            return None


def season_bounds(season_id: str) -> tuple[datetime, datetime]:
    first_year = int(season_id[:4])
    return datetime(first_year, 7, 1), datetime(first_year + 1, 7, 1)


def roster_row_overlaps(row: dict[str, Any], season_id: str, when: datetime | None) -> bool:
    added = date_value(row.get("added"))
    removed = date_value(row.get("removed"))
    if when is not None:
        return (added is None or added <= when) and (removed is None or removed >= when)
    start, end = season_bounds(season_id)
    return (added is None or added < end) and (removed is None or removed >= start)


def full_name(row: dict[str, Any]) -> str | None:
    return text(" ".join(part for part in (text(row.get("first_name")), text(row.get("last_name"))) if part))


def position_labels(row: dict[str, Any]) -> tuple[str | None, str | None]:
    raw = text(row.get("position"))
    fi = text(row.get("position_fi"))
    en = text(row.get("position_en"))
    key = canonical(raw)
    normalized_fi = canonical(fi) if fi else ""
    fi = fi or POSITION_FI.get(key) or POSITION_FI.get(normalized_fi)
    en = en or POSITION_EN.get(key) or POSITION_EN.get(normalized_fi)
    if fi:
        fi = fi[:1].upper() + fi[1:]
    if en:
        en = en[:1].upper() + en[1:]
    return fi, en


def nationality_code(row: dict[str, Any]) -> str | None:
    value = text(row.get("nationality")) or text(row.get("nationality_3"))
    return value.upper() if value and re.fullmatch(r"[a-z]{2,3}", value, flags=re.IGNORECASE) else None


def read_records(paths: list[str]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for relative in paths:
        path = ROOT / relative
        if not path.exists():
            raise FileNotFoundError(f"Missing player-statistics source: {path}")
        payload = json.loads(path.read_text(encoding="utf-8"))
        records.extend(payload.get("matches", []))
    return records


def match_context(client: BasketFiClient, config: dict[str, Any]) -> tuple[
    dict[str, list[str]], dict[str, datetime | None], dict[str, dict[str, str]]
]:
    payload = client.get_matches(config["competition_id"], config["category_id"])
    rows = payload.get("matches")
    if not isinstance(rows, list) or not rows:
        raise ValueError(f"Basket.fi returned no matches for {config['competition_id']} category {config['category_id']}")
    team_ids: dict[str, set[str]] = {}
    match_dates: dict[str, datetime | None] = {}
    match_teams: dict[str, dict[str, str]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        match_id = text(row.get("match_id"))
        if match_id:
            match_dates[match_id] = date_value(" ".join(part for part in (text(row.get("date")), text(row.get("time"))) if part))
            match_teams[match_id] = {
                "home": text(row.get("team_A_id")) or "",
                "away": text(row.get("team_B_id")) or "",
            }
        for side in ("A", "B"):
            team_id = text(row.get(f"team_{side}_id"))
            team_name = text(row.get(f"team_{side}_name"))
            if team_id and team_name:
                team_ids.setdefault(canonical(team_name), set()).add(team_id)
    return {name: sorted(ids) for name, ids in team_ids.items()}, match_dates, match_teams


def fetch_rosters(
    client: BasketFiClient,
    configurations: tuple[dict[str, Any], ...],
) -> tuple[
    dict[str, list[dict[str, Any]]],
    dict[tuple[str, str], tuple[dict[str, list[str]], dict[str, datetime | None], dict[str, dict[str, str]]]],
    dict[str, str],
]:
    team_names: dict[str, set[str]] = {}
    contexts: dict[tuple[str, str], tuple[dict[str, list[str]], dict[str, datetime | None], dict[str, dict[str, str]]]] = {}
    for config in configurations:
        names, dates, match_teams = match_context(client, config)
        contexts[(config["league_id"], config["season_id"])] = (names, dates, match_teams)
        for name, ids in names.items():
            team_names.setdefault(name, set()).update(ids)

    roster_by_id: dict[str, list[dict[str, Any]]] = {}
    failures: dict[str, str] = {}
    team_ids = sorted({team_id for ids in team_names.values() for team_id in ids})
    for index, team_id in enumerate(team_ids):
        try:
            payload = client.get_team(team_id)
            team = payload.get("team") if isinstance(payload.get("team"), dict) else {}
            players = team.get("players") if isinstance(team.get("players"), list) else []
            if players:
                roster_by_id[team_id] = [row for row in players if isinstance(row, dict)]
            else:
                failures[team_id] = "Basket.fi returned no player roster"
        except Exception as exc:
            failures[team_id] = f"{type(exc).__name__}: {exc}"
        if index < len(team_ids) - 1:
            time.sleep(1)
    return roster_by_id, contexts, failures

def collect_player_profiles(
    records: list[dict[str, Any]],
    team_ids_by_name: dict[str, list[str]],
    rosters_by_team_id: dict[str, list[dict[str, Any]]],
    match_dates: dict[str, datetime | None],
    match_teams: dict[str, dict[str, str]],
    season_id: str,
    roster_failures: dict[str, str],
) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    collected: dict[str, dict[str, set[Any]]] = {}
    matched_appearances = 0
    total_appearances = 0
    unmatched_names: set[str] = set()
    unmatched_teams: set[str] = set()

    for record in records:
        game = record.get("game", {})
        game_id = text(game.get("source_id"))
        when = match_dates.get(game_id or "") or date_value(game.get("scheduled_at"))
        for team in record.get("teams", []):
            team_key = canonical(team.get("name"))
            if not team_key:
                continue
            side = "home" if team.get("home_away") == "home" else "away"
            match_team_id = match_teams.get(game_id or "", {}).get(side)
            source_ids = [match_team_id] if match_team_id else team_ids_by_name.get(team_key, [])
            candidate_rows: list[dict[str, Any]] = []
            for source_id in source_ids:
                candidate_rows.extend(rosters_by_team_id.get(source_id, []))
            if not candidate_rows:
                unmatched_teams.add(str(team.get("name") or ""))
                continue

            for player in team.get("players", []):
                player_id = text(player.get("source_player_id"))
                name = text(player.get("display_name"))
                if not player_id or not name:
                    continue
                total_appearances += 1
                player_key = canonical(name)
                matches = [row for row in candidate_rows
                           if canonical(full_name(row)) == player_key
                           and roster_row_overlaps(row, season_id, when)]
                if not matches:
                    unmatched_names.add(name)
                    continue
                matched_appearances += 1
                values = collected.setdefault(player_id, {"position_fi": set(), "position_en": set(), "height_cm": set(), "nationality": set()})
                for row in matches:
                    fi, en = position_labels(row)
                    if fi:
                        values["position_fi"].add(fi)
                    if en:
                        values["position_en"].add(en)
                    try:
                        height = int(float(row.get("height")))
                    except (TypeError, ValueError):
                        height = 0
                    if 120 <= height <= 250:
                        values["height_cm"].add(height)
                    nationality = nationality_code(row)
                    if nationality:
                        values["nationality"].add(nationality)

    result: dict[str, dict[str, Any]] = {}
    for player_id, values in collected.items():
        # Stable bio fields are shown only when all matching Basket.fi roster
        # records agree. Roles may vary; preserve those as a season-level list.
        height_values = sorted(values["height_cm"])
        nationality_values = sorted(values["nationality"])
        positions_fi = sorted(values["position_fi"])
        positions_en = sorted(values["position_en"])
        profile = {
            "positions_fi": positions_fi,
            "positions_en": positions_en,
            "height_cm": height_values[0] if len(height_values) == 1 else None,
            "nationality": nationality_values[0] if len(nationality_values) == 1 else None,
        }
        if any(profile.values()):
            result[player_id] = profile

    coverage = {
        "matched_appearances": matched_appearances,
        "total_appearances": total_appearances,
        "matched_player_rate": round(matched_appearances / total_appearances, 4) if total_appearances else 0,
        "profiles_with_data": len(result),
        "roster_fetch_failures": {team_id: roster_failures[team_id] for team_id in sorted(roster_failures)
                                  if team_id in {source_id for ids in team_ids_by_name.values() for source_id in ids}},
    }
    return result, coverage


def main() -> None:
    client = BasketFiClient()
    print("Loading Basket.fi team rosters for the six available league seasons…", flush=True)
    rosters_by_team_id, contexts, roster_failures = fetch_rosters(client, SEASONS)
    print(f"Retrieved {len(rosters_by_team_id)} distinct team rosters; {len(roster_failures)} failed.", flush=True)

    season_results: list[dict[str, Any]] = []
    stable_values: dict[tuple[str, str], dict[str, set[Any]]] = {}
    for config in SEASONS:
        team_ids, match_dates, match_teams = contexts[(config["league_id"], config["season_id"])]
        records = read_records(config["stats"])
        profiles, coverage = collect_player_profiles(records, team_ids, rosters_by_team_id, match_dates, match_teams,
                                                     config["season_id"], roster_failures)
        player_ids = {
            player_id
            for record in records
            for team in record.get("teams", [])
            for player in team.get("players", [])
            if (player_id := text(player.get("source_player_id")))
        }
        season_results.append({"config": config, "records": records, "profiles": profiles,
                               "coverage": coverage, "player_ids": player_ids})
        for player_id, profile in profiles.items():
            values = stable_values.setdefault((config["league_id"], player_id), {"height_cm": set(), "nationality": set()})
            if profile["height_cm"] is not None:
                values["height_cm"].add(profile["height_cm"])
            if profile["nationality"] is not None:
                values["nationality"].add(profile["nationality"])

    for result in season_results:
        config = result["config"]
        profiles = result["profiles"]
        for player_id in result["player_ids"]:
            profile = profiles.setdefault(player_id, {
                "positions_fi": [], "positions_en": [], "height_cm": None, "nationality": None,
            })
            stable = stable_values.get((config["league_id"], player_id), {})
            for field in ("height_cm", "nationality"):
                values = stable.get(field, set())
                if profile[field] is None and len(values) == 1:
                    profile[field] = next(iter(values))
        profiles = {player_id: profile for player_id, profile in profiles.items() if any(profile.values())}
        coverage = result["coverage"]
        coverage["players_in_season"] = len(result["player_ids"])
        coverage["profiles_with_data"] = len(profiles)
        output_dir = ROOT / "web" / "public" / config["asset_prefix"]
        output_dir.mkdir(parents=True, exist_ok=True)
        output = {
            "schema_version": "0.1",
            "league_id": config["league_id"],
            "season_id": config["season_id"],
            "source_url": "https://tulospalvelu.basket.fi/",
            "updated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "coverage": coverage,
            "players": profiles,
        }
        destination = output_dir / f"player-profiles-{config['season_id']}.json"
        destination.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{config['league_id']} {config['season_id']}: {len(profiles)} profiles; "
              f"matched {coverage['matched_appearances']}/{coverage['total_appearances']} appearances "
              f"({coverage['matched_player_rate']:.0%}); wrote {destination.relative_to(ROOT)}", flush=True)


if __name__ == "__main__":
    main()
