from pathlib import Path
from tempfile import TemporaryDirectory
import json
import unittest

from ingestion.publish_possessions import publish
from normalization.basketfi_possessions import possessions_for_game
from tests.test_basketfi_onoff import fixture


def add_event(payload, index, clock, tid, pid, kind, subtype=None, success=None):
    events = payload["data"]["pbp"]["1"]["events"]
    events.insert(index, {"eventId": f"x{len(events)}-{kind}-{clock}", "periodId": 1, "clock": clock, "entityId": tid,
                          "personId": pid, "eventType": kind, "eventSubType": subtype, "success": success})


def add_box(record, tid, **stats):
    for team in record["teams"]:
        if team["source_id"] == tid:
            for stat, value in stats.items():
                team["stats"][stat] += value


def shift_starters_plus_minus(record, tid, points):
    """Credit a basket scored while both starting lineups are on court."""
    for team in record["teams"]:
        for player in team["players"]:
            if player["starter"]:
                player["stats"]["plus_minus"] += points if team["source_id"] == tid else -points


class PossessionTests(unittest.TestCase):
    def test_made_baskets_alternate_with_start_lineups(self):
        payload, record = fixture()
        diagnostics = {}
        possessions = possessions_for_game(payload, record, diagnostics=diagnostics)
        self.assertEqual([(p["offense"], p["start"], p["end"], p["points"]) for p in possessions],
                         [("a", "period_start", "made_fg", 2), ("b", "made_fg", "made_fg", 3),
                          ("a", "made_fg", "period_end", 0)])
        self.assertEqual(possessions[0]["offense_lineup"], ["a1", "a2", "a3", "a4", "a5"])
        # The bench player replaced a1 before b's basket.
        self.assertEqual(possessions[1]["defense_lineup"], ["a2", "a3", "a4", "a5", "a6"])
        self.assertEqual(possessions[1]["score_margin"], -2)
        # Nobody scored after b's basket, so a held the ball for the last four minutes.
        self.assertEqual(possessions[2]["seconds"], 240)
        self.assertEqual(diagnostics["unrecorded_changes"], [])

    def test_and_one_free_throw_stays_in_scoring_possession(self):
        payload, record = fixture()
        add_event(payload, 1, "PT08M0S", "b", "b2", "foul", "personal")
        add_event(payload, 2, "PT08M0S", "a", "a1", "freeThrow", "1Of1", True)
        add_box(record, "a", points=1, ftm=1, fta=1)
        shift_starters_plus_minus(record, "a", 1)
        possessions = possessions_for_game(payload, record)
        self.assertEqual([(p["offense"], p["end"], p["points"], p["fta"]) for p in possessions],
                         [("a", "made_ft", 3, 1), ("b", "made_fg", 3, 0), ("a", "period_end", 0, 0)])

    def test_defensive_rebound_and_steal_start_new_possessions(self):
        payload, record = fixture()
        add_event(payload, 0, "PT09M0S", "a", "a2", "3pt", success=False)
        add_event(payload, 1, "PT08M50S", "b", "b2", "rebound", "defensive", True)
        add_event(payload, 2, "PT08M30S", "b", "b2", "turnover", "badPass", True)
        add_event(payload, 3, "PT08M30S", "a", "a3", "steal", None, True)
        add_box(record, "a", three_pa=1, steals=1)
        add_box(record, "b", defensive_rebounds=1, rebounds=1, turnovers=1)
        possessions = possessions_for_game(payload, record)
        self.assertEqual([(p["offense"], p["start"], p["end"]) for p in possessions],
                         [("a", "period_start", "defensive_rebound"), ("b", "defensive_rebound", "turnover"),
                          ("a", "steal", "made_fg"), ("b", "made_fg", "made_fg"),
                          ("a", "made_fg", "period_end")])
        self.assertEqual([p["seconds"] for p in possessions[:2]], [70, 20])
        # The steal is listed after the turnover that closed b's possession.
        self.assertEqual([[(e["type"], e["player"]) for e in p["events"]] for p in possessions[:2]],
                         [[("3pt", "a2"), ("defensive_rebound", "b2")], [("turnover", "b2"), ("steal", "a3")]])

    def test_technical_free_throw_is_outside_possessions(self):
        payload, record = fixture()
        add_event(payload, 1, "PT06M0S", "b", None, "foul", "benchTechnical")
        add_event(payload, 2, "PT06M0S", "a", "a2", "freeThrow", "1Of1", True)
        add_box(record, "a", points=1, ftm=1, fta=1)
        shift_starters_plus_minus(record, "a", 1)
        diagnostics = {}
        possessions = possessions_for_game(payload, record, diagnostics=diagnostics)
        self.assertEqual([p["points"] for p in possessions], [2, 3, 0])
        self.assertEqual(diagnostics["teams"]["a"]["points_outside_possessions"], 1)

    def test_points_must_reconcile_with_box_score(self):
        payload, record = fixture()
        # The on/off reconstruction would also reject this, so the game is never split.
        add_box(record, "a", points=1)
        with self.assertRaises(ValueError):
            possessions_for_game(payload, record)

    def test_unreconciled_lineups_can_fall_back_to_scoring_only(self):
        payload, record = fixture()
        record["teams"][0]["players"][0]["minutes"] = 10  # Playing time no longer reconciles.
        with self.assertRaises(ValueError):
            possessions_for_game(payload, record)
        diagnostics = {}
        possessions = possessions_for_game(payload, record, diagnostics=diagnostics, require_lineups=False)
        self.assertEqual([(p["offense"], p["points"], p["offense_lineup"]) for p in possessions],
                         [("a", 2, None), ("b", 3, None), ("a", 0, None)])
        self.assertFalse(diagnostics["lineups"])

    def test_publish_excludes_missing_events_and_totals_lineups(self):
        payload, record = fixture()
        missing = {**record, "game": {**record["game"], "source_id": "missing"}}
        with TemporaryDirectory() as directory:
            (Path(directory) / "game.json").write_text(json.dumps(payload), encoding="utf-8")
            result = publish([record, missing], Path(directory), season_id="test")
        self.assertEqual(result["verified_games"], 1)
        self.assertEqual(result["excluded"][0]["match_id"], "missing")
        starters = next(u for u in result["lineups"] if u["players"] == ["a1", "a2", "a3", "a4", "a5"])
        self.assertEqual(starters["offense"], {"possessions": 1, "points": 2})


if __name__ == "__main__":
    unittest.main()
