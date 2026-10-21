import copy
import unittest

from tests.test_basketfi_onoff import fixture
from normalization.playing_time import legacy_minute_teams, recover_legacy_minutes, quarantine_legacy_minutes
from validation.checks import validate_statistics_snapshot


class PlayingTimeTests(unittest.TestCase):
    def broken(self):
        payload, record = fixture()
        for team in record["teams"]:
            for player in team["players"]:
                player["minutes"] = round(player["minutes"] / 60, 4)
        return payload, record

    def test_recovers_substitution_seconds_and_retains_original(self):
        payload, record = self.broken()
        for event in payload["data"]["pbp"]["1"]["events"]:
            if event["eventType"] == "substitution":
                event["clock"] = "PT05M12S"
        self.assertEqual(legacy_minute_teams(record), ["a", "b"])
        self.assertTrue(recover_legacy_minutes(record, payload))
        self.assertEqual(record["teams"][0]["players"][0]["minutes_display"], "34:48")
        self.assertEqual(record["teams"][0]["players"][5]["minutes"], 5.2)
        self.assertAlmostEqual(record["teams"][0]["players"][0]["source_fields"]["original_playing_time"]["minutes"], 35 / 60, places=3)
        self.assertFalse(recover_legacy_minutes(record, payload))

    def test_real_short_stint_is_never_scaled(self):
        payload, record = fixture()
        record["teams"][0]["players"][5]["minutes"] = .4
        self.assertEqual(legacy_minute_teams(record), [])
        before = copy.deepcopy(record)
        self.assertFalse(recover_legacy_minutes(record, payload))
        self.assertEqual(record, before)

    def test_mixed_import_changes_only_the_affected_player(self):
        payload, record = fixture()
        record["teams"][0]["players"][0]["minutes"] = round(35 / 60, 4)
        self.assertEqual(legacy_minute_teams(record), ["a"])
        self.assertTrue(recover_legacy_minutes(record, payload))
        self.assertEqual(record["teams"][0]["players"][0]["minutes"], 35)
        self.assertNotIn("source_fields", record["teams"][0]["players"][5])

    def test_bad_events_cannot_partially_mutate_record(self):
        payload, record = self.broken()
        payload["data"]["pbp"]["4"]["ended"] = False
        before = copy.deepcopy(record)
        with self.assertRaises(ValueError):
            recover_legacy_minutes(record, payload)
        self.assertEqual(record, before)
        quarantine_legacy_minutes(record, "unfinished period")
        self.assertIsNone(record["teams"][0]["players"][0]["minutes"])
        self.assertTrue(record["teams"][0]["players"][0]["participated"])
        self.assertEqual(record["teams"][0]["players"][0]["stats"], before["teams"][0]["players"][0]["stats"])

    def test_wrong_fixture_is_rejected(self):
        payload, record = self.broken()
        with self.assertRaisesRegex(ValueError, "fixture differs"):
            recover_legacy_minutes(record, payload, fixture_id="another-match")

    def test_stale_corrupt_cache_fails_validation(self):
        _, record = self.broken()
        checks = validate_statistics_snapshot(record)["checks"]
        self.assertIn({"name": "playing_time_units", "status": "fail",
                       "detail": "Team minutes contain the legacy minute-as-second import error"}, checks)
