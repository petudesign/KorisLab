from copy import deepcopy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from ingestion.publish_assists import publish_assists
from normalization.basketfi_assists import normalize_assists
from tests.test_basketfi_pbp import fixture


def assist_fixture():
    payload, record = fixture(overtime=True)
    for team in record["teams"]:
        team["players"] = [{"source_player_id": team["source_id"] + "-passer", "display_name": "Passer", "minutes": 40,
                            "stats": {"assists": 5 if team["source_id"] == "home" else 0}}]
        team["stats"]["assists"] = 5 if team["source_id"] == "home" else 0
    for q, period in payload["data"]["pbp"].items():
        shot = period["events"][0]
        shot.update(clock="PT05M00S", personId="home-scorer")
        period["events"].insert(1, {"eventId": f"{q}-assist", "eventType": "assist", "entityId": "home",
            "personId": "home-passer", "periodId": int(q), "clock": "PT05M00S"})
    return payload, record


class AssistTests(unittest.TestCase):
    def test_three_point_assists_include_overtime_and_can_precede_basket(self):
        payload, record = assist_fixture()
        events = payload["data"]["pbp"]["1"]["events"]
        events[0], events[1] = events[1], events[0]
        rows = normalize_assists(payload, record, fixture_id="fixture")
        self.assertEqual(rows[0]["three"], 5)
        self.assertEqual(rows[0]["unlinked"], 0)

    def test_free_throw_assists_are_not_counted_as_field_goals(self):
        payload, record = assist_fixture()
        payload["data"]["pbp"]["1"]["events"].insert(1, {"eventId": "extra-ft", "eventType": "freeThrow",
            "entityId": "home", "personId": "home-scorer", "success": False, "clock": "PT05M00S", "periodId": 1})
        rows = normalize_assists(payload, record, fixture_id="fixture")
        self.assertEqual(rows[0]["three"], 4)
        self.assertEqual(rows[0]["free_throw"], 1)

    def test_clock_mismatch_is_unlinked_instead_of_guessed(self):
        payload, record = assist_fixture()
        payload["data"]["pbp"]["1"]["events"][1]["clock"] = "PT04M59S"
        rows = normalize_assists(payload, record, fixture_id="fixture")
        self.assertEqual(rows[0]["unlinked"], 1)
        self.assertEqual(rows[0]["three"], 4)

    def test_repeated_clock_requires_matching_score(self):
        payload, record = assist_fixture()
        period = payload["data"]["pbp"]["1"]
        period["events"][0]["scores"] = {"home": 3, "away": 0}
        period["events"][1]["scores"] = {"home": 3, "away": 0}
        period["events"].append({"eventId": "second-basket", "eventType": "2pt", "success": True,
            "entityId": "home", "personId": "home-scorer", "clock": "PT05M00S", "periodId": 1, "scores": {"home": 5, "away": 0}})
        record["game"]["periods"][0]["home_score"] = 5
        record["teams"][0]["stats"]["points"] += 2
        rows = normalize_assists(payload, record, fixture_id="fixture")
        self.assertEqual(rows[0]["three"], 5)
        self.assertEqual(rows[0]["two"], 0)
        del period["events"][1]["scores"]
        self.assertEqual(normalize_assists(payload, record, fixture_id="fixture")[0]["unlinked"], 1)

    def test_duplicate_assignment_is_unlinked(self):
        payload, record = assist_fixture()
        extra = deepcopy(payload["data"]["pbp"]["1"]["events"][1])
        extra["eventId"] = "extra-assist"
        payload["data"]["pbp"]["1"]["events"].append(extra)
        record["teams"][0]["stats"]["assists"] = 6
        record["teams"][0]["players"][0]["stats"]["assists"] = 6
        rows = normalize_assists(payload, record, fixture_id="fixture")
        self.assertEqual(rows[0]["three"], 5)
        self.assertEqual(rows[0]["unlinked"], 1)

    def test_box_score_mismatch_or_unknown_passer_rejects_game(self):
        payload, record = assist_fixture()
        record["teams"][0]["players"][0]["stats"]["assists"] = 4
        with self.assertRaises(ValueError):
            normalize_assists(payload, record, fixture_id="fixture")
        payload, record = assist_fixture()
        payload["data"]["pbp"]["1"]["events"][1]["personId"] = "unknown"
        with self.assertRaises(ValueError):
            normalize_assists(payload, record, fixture_id="fixture")

    def test_missing_game_cache_reports_partial_coverage_and_empty_season_has_no_stats(self):
        payload, record = assist_fixture()
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "1.json").write_text(json.dumps(payload), encoding="utf-8")
            missing = deepcopy(record)
            missing["game"]["source_id"] = "2"
            result = publish_assists([record, missing], season_id="test", out=root / "out.json", cache_dir=root)
            summary = json.loads((root / "out.json").read_text())
            self.assertEqual(result["verified_games"], 1)
            self.assertEqual(summary["expected_games"], 2)
            self.assertEqual(summary["players"][0]["games"], 1)
            self.assertEqual(len(summary["failures"]), 1)
            publish_assists([], season_id="next", out=root / "empty.json", cache_dir=root)
            self.assertEqual(json.loads((root / "empty.json").read_text())["players"], [])
