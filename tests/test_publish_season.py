import unittest
from copy import deepcopy
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

from ingestion.publish_season import build_snapshot
from ingestion.season_statistics import hydrate_season_statistics
from normalization.basketfi_statistics import normalize_fixture_statistics
from tests.test_basketfi_statistics import fixture_payload


class PublishSeasonTests(unittest.TestCase):
    def schedule(self, status="Played"):
        return [{"source_match_id": "1", "status": status, "scheduled_date": "2026-10-02", "home": {"name": "Home"}, "away": {"name": "Away"}}]

    def test_unplayed_game_has_no_fabricated_statistics(self):
        result = build_snapshot(self.schedule("Fixture"), {"snapshots": [], "summary": {}, "failures": []})
        self.assertEqual(result["schedule_summary"]["games"], 1)
        self.assertEqual(result["schedule_summary"]["played_games"], 0)
        self.assertEqual(result["matches"], [])
        self.assertEqual(result["aggregate"]["games"], 0)

    def test_failed_refresh_retains_previous_valid_box_score(self):
        record = normalize_fixture_statistics(fixture_payload(), match_id="1")
        hydration = {"snapshots": [], "summary": {"failed_games": 1}, "failures": [{"source_match_id": "1", "error": "source unavailable"}]}
        result = build_snapshot(self.schedule(), hydration, previous={"matches": [record]})
        self.assertEqual(result["summary"]["valid_games"], 1)
        self.assertEqual(result["aggregate"]["games"], 1)
        self.assertEqual(result["matches"][0]["game"]["scheduled_at"], "2026-10-02")
        self.assertEqual(len(result["failures"]), 1)

    def test_corrected_box_score_replaces_previous_without_double_counting(self):
        record = normalize_fixture_statistics(fixture_payload(), match_id="1")
        updated = deepcopy(record)
        updated["source"]["ingested_at_utc"] = "2026-10-03T00:00:00Z"
        result = build_snapshot(self.schedule(), {"snapshots": [updated], "summary": {}, "failures": []}, previous={"matches": [record]})
        self.assertEqual(len(result["matches"]), 1)
        self.assertEqual(result["aggregate"]["games"], 1)
        self.assertEqual(result["matches"][0]["source"]["ingested_at_utc"], "2026-10-03T00:00:00Z")

    def test_expired_cache_is_refetched(self):
        fetcher = Mock(return_value=normalize_fixture_statistics(fixture_payload(), match_id="1"))
        with TemporaryDirectory() as directory:
            hydrate_season_statistics(self.schedule(), fetcher, cache_dir=Path(directory))
            # A zero TTL must force a refresh even if filesystem time is slightly ahead.
            with patch("ingestion.season_statistics.time", return_value=0):
                result = hydrate_season_statistics(self.schedule(), fetcher, cache_dir=Path(directory), cache_max_age_seconds=0)
        self.assertEqual(fetcher.call_count, 2)
        self.assertEqual(result["summary"]["cached_games"], 0)

    def test_unchanged_snapshot_keeps_publication_time(self):
        hydration = {"snapshots": [], "summary": {}, "failures": []}
        previous = build_snapshot(self.schedule("Fixture"), hydration)
        previous["updated_at"] = "2026-10-01T12:00:00Z"
        refreshed = build_snapshot(self.schedule("Fixture"), hydration, previous=previous)
        self.assertEqual(refreshed, previous)
