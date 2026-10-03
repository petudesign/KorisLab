"""Publish on/off totals from cached events; exclude every unreconciled game."""
import argparse
import json
from pathlib import Path
from normalization.basketfi_onoff import PLAYING_TIME_TOLERANCE_SECONDS, STATS, empty_state, reconstruct_game


def publish(records, cache, *, season_id="2025-26", playing_time_tolerance_seconds=PLAYING_TIME_TOLERANCE_SECONDS):
    players = {}
    for record in records:
        for team in record["teams"]:
            for player in team["players"]:
                key = (team["source_id"], player["source_player_id"])
                players.setdefault(key, {"id": key[1], "team_id": key[0], "games": 0, "on": empty_state(), "off": empty_state()})
    verified, excluded, diagnostics = [], [], []
    for record in records:
        match_id = record["game"]["source_id"]
        try:
            payload = json.loads((cache / f"{match_id}.json").read_text(encoding="utf-8"))
            match_diagnostics = {}
            states, totals, seconds = reconstruct_game(payload, record,
                playing_time_tolerance_seconds=playing_time_tolerance_seconds, diagnostics=match_diagnostics)
        except (ValueError, KeyError, OSError) as error:
            excluded.append({"match_id": match_id, "reason": str(error)})
            continue
        verified.append(match_id)
        diagnostics.append({"match_id": match_id, **match_diagnostics})
        for (tid, pid), target in players.items():
            if tid not in states:
                continue
            pair = states[tid].get(pid)
            if pair is None:
                # A player not listed in this team's box score was off for the whole game.
                other = next(t for t in states if t != tid)
                representative = next(iter(states[tid].values()))
                pair = {"on": empty_state(), "off": {"seconds": seconds,
                    "own": {k: None if representative['on']['own'][k] is None else totals[tid][k] for k in STATS},
                    "opponent": {k: None if representative['on']['opponent'][k] is None else totals[other][k] for k in STATS}}}
            target["games"] += 1
            for side in ("on", "off"):
                target[side]["seconds"] += pair[side]["seconds"]
                for perspective in ("own", "opponent"):
                    for stat in STATS:
                        a, b = target[side][perspective][stat], pair[side][perspective][stat]
                        target[side][perspective][stat] = None if a is None or b is None else a + b
    return {"schema_version": "0.1", "season_id": season_id, "expected_games": len(records),
            "verified_games": len(verified), "match_ids": verified, "excluded": excluded,
            "methodology": {"playing_time_tolerance_seconds": playing_time_tolerance_seconds,
                "same_clock_policy": "unique_prior_lineup", "ambiguous_optional_stats": "unavailable"},
            "diagnostics": diagnostics,
            "players": [p for p in players.values() if p["on"]["seconds"] > 0]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--records", type=Path, default=Path("data/normalized/season_verified.json"))
    parser.add_argument("--cache", type=Path, default=Path("data/cache/pbp"))
    parser.add_argument("--out", type=Path, default=Path("web/public/onoff-2025-26.json"))
    parser.add_argument("--season-id", default="2025-26")
    parser.add_argument("--playing-time-tolerance-seconds", type=float, default=PLAYING_TIME_TOLERANCE_SECONDS)
    args = parser.parse_args()
    result = publish(json.loads(args.records.read_text(encoding="utf-8"))["matches"], args.cache,
        season_id=args.season_id, playing_time_tolerance_seconds=args.playing_time_tolerance_seconds)
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"verified": result["verified_games"], "expected": result["expected_games"], "excluded": result["excluded"]}, ensure_ascii=False))
