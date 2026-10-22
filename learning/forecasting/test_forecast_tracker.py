import copy
from datetime import datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from forecast_tracker import HELSINKI, append_history, digest, evaluate_history, forecasts, kickoff


LOCK = {"version": "test", "prior_games": 5, "feature_divisor": 10,
        "models": {"margin": {"slope": 1, "bias": 0}, "margin_home": {"slope": 1, "bias": 0.2}}}
NOW = datetime(2026, 10, 13, 15, tzinfo=HELSINKI)


def game(match_id, date, played=False):
    return {"id": match_id, "date": date + "T12:00:00", "time": "18:30:00",
            "status": "played" if played else "fixture", "verified": played,
            "teams": [{"id": "A", "name": "A", "side": "home", "score": 80 if played else None},
                      {"id": "B", "name": "B", "side": "away", "score": 70 if played else None}]}


class TrackerTests(unittest.TestCase):
    def test_kickoff_uses_explicit_time_and_does_not_forecast_started_fixture(self):
        fixture = game("1", "2026-10-13")
        self.assertEqual(kickoff(fixture).hour, 18)
        self.assertEqual(len(forecasts([fixture], LOCK, NOW, "source")), 1)
        self.assertEqual(forecasts([fixture], LOCK, NOW + timedelta(hours=4), "source"), [])

    def test_same_day_and_future_results_do_not_change_features(self):
        fixture = game("f", "2026-10-14")
        base = forecasts([game("past", "2026-10-12", True), fixture], LOCK, NOW, "source")[0]
        altered = forecasts([game("past", "2026-10-12", True), game("today", "2026-10-13", True),
                             game("future", "2026-10-20", True), fixture], LOCK, NOW, "source")[0]
        self.assertEqual(base["feature"], altered["feature"])
        self.assertEqual(base["home_prior_games"], 1)

    def test_history_appends_preserves_old_record_and_deduplicates(self):
        games = [game("past", "2026-10-12", True), game("f", "2026-10-14")]
        with TemporaryDirectory() as directory:
            path = Path(directory) / "history.jsonl"
            first = forecasts(games, LOCK, NOW, "source")
            history, _, added = append_history(path, first)
            self.assertEqual(added, 1)
            original_bytes = path.read_bytes()
            _, latest, added = append_history(path, forecasts(games, LOCK, NOW + timedelta(minutes=1), "source"))
            self.assertEqual(added, 0)
            self.assertEqual(path.read_bytes(), original_bytes)
            self.assertEqual(latest[0]["created_at"], first[0]["created_at"])
            games[0]["teams"][0]["score"] = 95
            history, _, added = append_history(path, forecasts(games, LOCK, NOW + timedelta(minutes=2), "changed"))
            self.assertEqual(added, 1)
            self.assertTrue(path.read_bytes().startswith(original_bytes))
            self.assertEqual(history[0], first[0])

    def test_results_only_evaluate_first_eligible_pre_match_forecast(self):
        fixture = game("f", "2026-10-14")
        too_early = forecasts([fixture], LOCK, NOW - timedelta(days=10), "source")[0]
        first = forecasts([fixture], LOCK, NOW, "source")[0]
        later = forecasts([fixture], LOCK, NOW + timedelta(hours=1), "source")[0]
        history = [too_early, first, later]
        self.assertEqual(evaluate_history(history, [fixture], digest(LOCK), NOW), [])
        result = game("f", "2026-10-14", True)
        evaluated = evaluate_history(history, [result], digest(LOCK), NOW + timedelta(days=2))
        self.assertEqual(len(evaluated), 1)
        self.assertEqual(evaluated[0]["forecast"]["created_at"], first["created_at"])
        result["date"] = "2026-10-15T12:00:00"
        self.assertEqual(evaluate_history(history, [result], digest(LOCK), NOW + timedelta(days=3)), [])

    def test_future_window_transition_is_a_new_record(self):
        fixture = game("f", "2026-10-25")
        early = forecasts([fixture], LOCK, NOW, "source")[0]
        eligible = forecasts([fixture], LOCK, NOW + timedelta(days=6), "source")[0]
        self.assertFalse(early["evaluation_eligible"])
        self.assertTrue(eligible["evaluation_eligible"])
        self.assertNotEqual(early["input_signature"], eligible["input_signature"])

    def test_tampered_archive_is_not_silently_replaced(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "history.jsonl"
            records = forecasts([game("f", "2026-10-14")], LOCK, NOW, "source")
            append_history(path, records)
            changed = copy.deepcopy(records[0])
            changed["probabilities"]["margin"] = 0.9
            import json
            path.write_text(json.dumps(changed) + "\n")
            with self.assertRaises(ValueError):
                append_history(path, records)


if __name__ == "__main__":
    unittest.main()
