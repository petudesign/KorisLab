from copy import deepcopy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock

from ingestion.publish_quarters import publish_quarters
from normalization.basketfi_pbp import METRICS, normalize_quarter_stats
from normalization.basketfi_replay import normalize_replay
from normalization.basketfi_statistics import normalize_fixture_statistics
from tests.basketfi_fixtures import FIXTURE_ID, basketfi_payload


def fixture(overtime=False):
    pbp = {}
    for q in [1, 2, 3, 4] + ([11] if overtime else []):
        pbp[str(q)] = {"ended": True, "events": [
            {"eventId": f"{q}-shot", "eventType": "3pt", "success": True, "entityId": "home", "periodId": q},
            {"eventId": f"{q}-ft", "eventType": "freeThrow", "success": False, "entityId": "away", "periodId": q},
            {"eventId": f"{q}-steal", "eventType": "steal", "entityId": "home", "periodId": q},
            # Team turnovers with no individual player still count.
            {"eventId": f"{q}-to", "eventType": "turnover", "entityId": "away", "personId": None, "periodId": q}]}
    periods = len(pbp)
    teams = [
        {"source_id": "home", "name": "Home", "home_away": "home", "stats": {"points": 3 * periods, "three_pa": periods, "fta": 0, "steals": periods, "turnovers": 0}},
        {"source_id": "away", "name": "Away", "home_away": "away", "stats": {"points": 0, "three_pa": 0, "fta": periods, "steals": 0, "turnovers": periods}}]
    record = {"game": {"source_id": "1", "upstream_fixture_id": "fixture", "periods": [{"home_score": 3, "away_score": 0} for _ in pbp]}, "teams": teams}
    payload = {"data": {"banner": {"fixture": {"id": "fixture", "competitors": [{"entityId": "home"}, {"entityId": "away"}]}}, "pbp": pbp}}
    return payload, record


class QuarterTests(unittest.TestCase):
    def test_zero_is_valid_and_team_events_count(self):
        payload, record = fixture()
        normalized = normalize_quarter_stats(payload, record, fixture_id="fixture")
        self.assertEqual(set(normalized["verified_metrics"]), set(METRICS))
        self.assertEqual(normalized["periods"]["1"]["away"]["turnovers"], 1)
        self.assertEqual(normalized["periods"]["1"]["away"]["points"], 0)

    def test_overtime_is_verified_but_not_folded_into_quarter_four(self):
        payload, record = fixture(overtime=True)
        normalized = normalize_quarter_stats(payload, record, fixture_id="fixture")
        self.assertEqual(normalized["periods"]["4"]["home"]["points"], 3)
        self.assertEqual(normalized["periods"]["11"]["home"]["points"], 3)

    def test_incomplete_duplicate_or_wrong_fixture_is_rejected(self):
        payload, record = fixture()
        with self.assertRaises(ValueError):
            normalize_quarter_stats(payload, record, fixture_id="other")
        incomplete = deepcopy(payload)
        incomplete["data"]["pbp"]["4"]["ended"] = False
        with self.assertRaises(ValueError):
            normalize_quarter_stats(incomplete, record, fixture_id="fixture")
        payload["data"]["pbp"]["1"]["events"] *= 2
        with self.assertRaises(ValueError):
            normalize_quarter_stats(payload, record, fixture_id="fixture")

    def test_metric_mismatch_excludes_only_that_metric(self):
        payload, record = fixture()
        record["teams"][0]["stats"]["steals"] = 5
        normalized = normalize_quarter_stats(payload, record, fixture_id="fixture")
        self.assertNotIn("steals", normalized["verified_metrics"])
        self.assertIn("points", normalized["verified_metrics"])

    def test_wrong_quarter_scores_are_rejected_even_if_full_game_matches(self):
        payload, record = fixture()
        record["game"]["periods"][0]["home_score"] = 2
        record["game"]["periods"][1]["home_score"] = 4
        with self.assertRaises(ValueError):
            normalize_quarter_stats(payload, record, fixture_id="fixture")

    def test_legacy_and_current_period_data_reconcile_for_quarters_and_replay(self):
        for schema in ("legacy", "current"):
            with self.subTest(schema=schema):
                payload = basketfi_payload(schema)
                record = normalize_fixture_statistics(payload, match_id="1005837")
                quarters = normalize_quarter_stats(payload, record, fixture_id=FIXTURE_ID)
                replay = normalize_replay(payload, record, season_id="2026-27")

                self.assertIn("points", quarters["verified_metrics"])
                self.assertEqual(quarters["event_count"], 7)
                self.assertTrue(replay["verified"])
                self.assertEqual(replay["events"][-1]["home"], 8)
                self.assertEqual(replay["events"][-1]["away"], 6)

    def test_refresh_failure_keeps_valid_cache_and_denominator(self):
        payload, record = fixture(overtime=True)
        client = Mock()
        client.get_fixture.return_value = payload
        with TemporaryDirectory() as directory:
            root = Path(directory)
            kwargs = {"season_id": "test", "out": root / "summary.json", "cache_dir": root / "cache", "client": client, "delay_seconds": 0}
            publish_quarters([record], **kwargs)
            client.get_fixture.side_effect = RuntimeError("offline")
            result = publish_quarters([record], max_age_seconds=0, **kwargs)
            summary = json.loads((root / "summary.json").read_text())
            self.assertEqual(len(result["failures"]), 1)
            self.assertEqual(summary["teams"][0]["periods"]["4"]["points"], {"games": 1, "total": 3})
            # Without the cache, a transient outage must retain the published summary.
            result = publish_quarters([record], **{**kwargs, "cache_dir": root / "empty"})
            self.assertTrue(result["retained_previous"])
