import unittest
from copy import deepcopy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

from ingestion.publish_season import build_snapshot, verify_publication_coverage
from ingestion.season_statistics import hydrate_season_statistics
from ingestion.publish_shots import publish_shots
from normalization.basketfi_replay import normalize_replay
from normalization.basketfi_statistics import normalize_fixture_statistics
from tests.basketfi_fixtures import basketfi_payload
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

    def _completed_publication(self, root):
        payload = basketfi_payload("current")
        record = normalize_fixture_statistics(payload, match_id="1005837")
        schedule = [{"source_match_id": "1005837", "status": "Played"}]
        snapshot = {"matches": [record]}
        quarter_teams = []
        for team in record["teams"]:
            quarter_teams.append({
                "id": team["source_id"],
                "name": team["name"],
                "periods": {
                    str(period["period"]): {"points": {"games": 1, "total": period[f"{team['home_away']}_score"]}}
                    for period in record["game"]["periods"]
                },
            })
        quarters_path = root / "quarters.json"
        quarters_path.write_text(json.dumps({
            "season_id": "2026-27",
            "expected_games": 1,
            "verified_games": 1,
            "teams": quarter_teams,
        }), encoding="utf-8")
        shots_dir = root / "shots"
        client = Mock()
        client.get_fixture.return_value = payload
        shot_summary = publish_shots([record], out_dir=shots_dir, client=client, delay_seconds=0)
        replays_dir = root / "replays"
        replay = normalize_replay(payload, record, season_id="2026-27")
        replays_dir.mkdir(parents=True)
        (replays_dir / "1005837.json").write_text(json.dumps(replay), encoding="utf-8")
        return schedule, snapshot, quarters_path, shots_dir, replays_dir, shot_summary

    def test_publication_coverage_accepts_verified_current_schema_outputs(self):
        with TemporaryDirectory() as directory:
            args = self._completed_publication(Path(directory))

            coverage = verify_publication_coverage(
                args[0], args[1], season_id="2026-27", quarters_path=args[2],
                shots_dir=args[3], replays_dir=args[4], shot_summary=args[5],
            )

        self.assertEqual(coverage, {
            "played_games": 1,
            "statistics_verified": 1,
            "quarter_scores_verified": 1,
            "replays_verified": 1,
            "shot_charts_available": 1,
            "shot_charts_unavailable": 0,
        })

    def test_publication_coverage_allows_explicitly_unavailable_shot_coordinates(self):
        with TemporaryDirectory() as directory:
            args = self._completed_publication(Path(directory))
            (args[3] / "1005837.json").unlink()
            args[5]["unavailable"] = [{"match_id": "1005837", "reason": "No shot chart in source response"}]

            coverage = verify_publication_coverage(
                args[0], args[1], season_id="2026-27", quarters_path=args[2],
                shots_dir=args[3], replays_dir=args[4], shot_summary=args[5],
            )

        self.assertEqual(coverage["shot_charts_available"], 0)
        self.assertEqual(coverage["shot_charts_unavailable"], 1)

    def test_publication_coverage_uses_verified_replay_when_box_score_omits_period_rows(self):
        with TemporaryDirectory() as directory:
            args = self._completed_publication(Path(directory))
            args[1]["matches"][0]["game"]["periods"] = []

            coverage = verify_publication_coverage(
                args[0], args[1], season_id="2026-27", quarters_path=args[2],
                shots_dir=args[3], replays_dir=args[4], shot_summary=args[5],
            )

        self.assertEqual(coverage["quarter_scores_verified"], 1)

    def test_publication_coverage_fails_when_quarter_total_disagrees_with_replay(self):
        with TemporaryDirectory() as directory:
            args = self._completed_publication(Path(directory))
            quarter_snapshot = json.loads(args[2].read_text(encoding="utf-8"))
            quarter_snapshot["teams"][0]["periods"]["1"]["points"]["total"] += 1
            args[2].write_text(json.dumps(quarter_snapshot), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "quarter summary: period 1 point coverage or totals"):
                verify_publication_coverage(
                    args[0], args[1], season_id="2026-27", quarters_path=args[2],
                    shots_dir=args[3], replays_dir=args[4], shot_summary=args[5],
                )

    def test_publication_coverage_fails_when_replay_is_missing(self):
        with TemporaryDirectory() as directory:
            args = self._completed_publication(Path(directory))
            (args[4] / "1005837.json").unlink()

            with self.assertRaisesRegex(ValueError, "verified replay is missing"):
                verify_publication_coverage(
                    args[0], args[1], season_id="2026-27", quarters_path=args[2],
                    shots_dir=args[3], replays_dir=args[4], shot_summary=args[5],
                )
