import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock

from ingestion.publish_shots import publish_player_shot_index, publish_shots
from normalization.basketfi_shots import normalize_shot_chart


def payload():
    return {"data": {"fixture": {"id": "fixture", "competitors": [
        {"entityId": "home", "name": "Home", "isHome": True},
        {"entityId": "away", "name": "Away", "isHome": False}]},
        "shotChart": {"shots": [{"eventId": "shot", "entityId": "home", "personId": "player",
            "name": "Player", "periodId": 1, "clock": "PT09M33S", "eventType": "2pt",
            "success": True, "x": 12, "y": 81}]}}}


class ShotChartTests(unittest.TestCase):
    def test_source_player_identity_and_coordinates_are_preserved(self):
        shot = normalize_shot_chart(payload(), match_id="1", fixture_id="fixture")["shots"][0]
        self.assertEqual((shot["player_id"], shot["x"], shot["y"], shot["made"]), ("player", 12, 81, True))

    def test_invalid_coordinates_are_missing_not_zero(self):
        data = payload()
        data["data"]["shotChart"]["shots"][0]["x"] = 101
        self.assertIsNone(normalize_shot_chart(data, match_id="1", fixture_id="fixture")["shots"][0]["x"])

    def test_banner_identity_and_legacy_fixture_id_are_supported(self):
        data = payload()
        data["data"]["banner"] = {"fixture": data["data"]["fixture"]}
        data["data"]["fixture"] = {"fixtureId": "fixture"}
        self.assertEqual(len(normalize_shot_chart(data, match_id="1", fixture_id="fixture")["shots"]), 1)

    def test_legacy_box_score_resolves_fixture_via_match(self):
        record = {"game": {"source_id": "1", "upstream_fixture_id": None}, "teams": []}
        client = Mock()
        client.torneo_client.get_match.return_value = {"match": {"match_external_id": "fixture"}}
        client.get_fixture.return_value = payload()
        with TemporaryDirectory() as directory:
            result = publish_shots([record], out_dir=Path(directory), client=client, delay_seconds=0)
        self.assertEqual(result["published"], 1)
        client.get_fixture.assert_called_once_with("fixture", sub="shot_chart")

    def test_wrong_fixture_or_duplicate_events_are_rejected(self):
        with self.assertRaises(ValueError):
            normalize_shot_chart(payload(), match_id="1", fixture_id="other")
        data = payload()
        data["data"]["shotChart"]["shots"] *= 2
        with self.assertRaises(ValueError):
            normalize_shot_chart(data, match_id="1", fixture_id="fixture")

    def test_refresh_failure_preserves_previous_chart_and_partial_totals_are_marked(self):
        record = {"game": {"source_id": "1", "upstream_fixture_id": "fixture"}, "teams": [
            {"source_id": team, "stats": {"two_pa": 1, "two_pm": 1, "three_pa": 0, "three_pm": 0}}
            for team in ("home", "away")]}
        client = Mock()
        client.get_fixture.return_value = payload()
        with TemporaryDirectory() as directory:
            out_dir = Path(directory)
            publish_shots([record], out_dir=out_dir, client=client, delay_seconds=0)
            before = (out_dir / "1.json").read_text(encoding="utf-8")
            import json
            self.assertFalse(json.loads(before)["box_score_matches"])
            client.get_fixture.side_effect = RuntimeError("offline")
            result = publish_shots([record], out_dir=out_dir, client=client, max_age_seconds=0, delay_seconds=0)
            self.assertEqual(len(result["failures"]), 1)
            self.assertEqual((out_dir / "1.json").read_text(encoding="utf-8"), before)

    def test_player_index_groups_shots_by_verified_player_id(self):
        record = {"game": {"source_id": "1", "upstream_fixture_id": "fixture"}, "teams": [
            {"source_id": "home", "stats": {"two_pa": 1, "two_pm": 1, "three_pa": 0, "three_pm": 0}},
            {"source_id": "away", "stats": {"two_pa": 0, "two_pm": 0, "three_pa": 0, "three_pm": 0}},
        ]}
        client = Mock()
        client.get_fixture.return_value = payload()
        with TemporaryDirectory() as directory:
            out_dir = Path(directory)
            publish_shots([record], out_dir=out_dir, client=client, delay_seconds=0)
            target = out_dir / "player-shots.json"
            result = publish_player_shot_index([record], season_id="2025-26", out_dir=out_dir, out=target)
            import json
            snapshot = json.loads(target.read_text(encoding="utf-8"))
        self.assertEqual((result["games_with_data"], result["expected_games"], result["players"]), (1, 1, 1))
        self.assertTrue(snapshot["box_score_matches"])
        self.assertEqual(snapshot["players"][0]["id"], "player")
        self.assertEqual(snapshot["players"][0]["shots"], [{"x": 12, "y": 81, "points": 2, "made": True}])
