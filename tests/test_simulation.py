from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from simulation.court import shot_zone, to_left_half
from simulation.export import publish_packs
from simulation.player_sim import GameSimulator, PlayerModel, offensive_chances
from simulation.track import HELSINKI, attach_results, record_forecasts, summarize


def event(team, player, kind, clock, **fields):
    return {"type": kind, "team": team, "player": player, "clock": clock, **fields}


def record():
    def team(tid):
        players = [{"source_player_id": f"{tid}{i}", "display_name": f"{tid.upper()} Player {i}", "starter": i <= 5,
                    "minutes": 36 if i <= 5 else 20, "stats": {}} for i in range(1, 7)]
        return {"source_id": tid, "name": f"Team {tid.upper()}", "home_away": "home" if tid == "a" else "away", "players": players}
    return {"teams": [team("a"), team("b")]}


def game(day):
    """a's shooter hits corner threes; b misses jumpers and a rebounds."""
    possessions = []
    for i in range(80):
        clock = 600 - i * 7
        possessions.append({"period": 1, "offense": "a", "defense": "b", "start": "defensive_rebound", "end": "made_fg",
                            "seconds": 14, "events": [event("a", "a1", "3pt", clock, made=True, x=3, y=4, assist="a2"),
                                                      event("a", "a2", "assist", clock)]})
        possessions.append({"period": 1, "offense": "b", "defense": "a", "start": "made_fg", "end": "defensive_rebound",
                            "seconds": 14, "events": [event("b", "b1", "2pt", clock - 3, made=False, x=20, y=30),
                                                      event("a", "a3", "defensive_rebound", clock - 4)]})
    return {"match_id": str(day), "date": f"2026-01-{day:02d}", "weight": 1.0, "home": "a",
            "possessions": possessions, "record": record()}


class CourtTests(unittest.TestCase):
    def test_zones_attack_either_basket(self):
        self.assertEqual(shot_zone("2pt", 6, 50), "rim")
        self.assertEqual(shot_zone("2pt", 94, 50), "rim")
        self.assertEqual(shot_zone("2pt", 15, 50), "paint")
        self.assertEqual(shot_zone("2pt", 18, 20), "midrange")
        self.assertEqual(shot_zone("3pt", 3, 4), "corner_three")
        self.assertEqual(shot_zone("3pt", 30, 50), "above_break_three")
        self.assertEqual(to_left_half(80, 30), (20, 70))


class ChanceTests(unittest.TestCase):
    def test_and_one_is_not_a_new_free_throw_trip(self):
        possession = {"offense": "a", "events": [
            event("a", "a1", "2pt", 100, made=True), event("a", "a1", "free_throw", 100, subtype="1Of1", made=True),
            event("a", "a2", "free_throw", 80, subtype="1Of2", made=True), event("a", "a2", "free_throw", 80, subtype="2Of2", made=False),
            event("b", "b1", "steal", 70), event("a", "a3", "turnover", 70)]}
        self.assertEqual([kind for kind, _ in offensive_chances(possession)], ["shot", "free_throws", "turnover"])


class SimulatorTests(unittest.TestCase):
    def setUp(self):
        self.model = PlayerModel([game(day) for day in range(1, 6)])

    def test_strong_shooter_team_wins_and_log_reconciles(self):
        simulator = GameSimulator(self.model, "a", "b")
        results = [simulator.play(seed) for seed in range(40)]
        self.assertGreater(sum(r["score"]["a"] > r["score"]["b"] for r in results), 30)
        logged = simulator.play(3, keep_log=True)
        self.assertEqual(logged, {**simulator.play(3, keep_log=True)})
        points = {"a": 0, "b": 0}
        for entry in logged["log"]:
            points[entry["team"]] += entry.get("points", 0)
        self.assertEqual(points, logged["score"])
        self.assertEqual(sum(1 for e in logged["log"] if e["type"] == "lineup" and e["period"] == 1 and e["t"] == 0), 2)

    def test_assist_pairs_follow_history(self):
        simulator = GameSimulator(self.model, "a", "b")
        pairs = {}
        for seed in range(20):
            for pair, count in simulator.play(seed)["pairs"].items():
                pairs[pair] = pairs.get(pair, 0) + count
        self.assertEqual(max(pairs, key=pairs.get), ("a2", "a1"))

    def test_unknown_team_is_rejected(self):
        with self.assertRaises(ValueError):
            GameSimulator(self.model, "a", "missing")


class PublishTests(unittest.TestCase):
    def test_packs_are_deterministic_and_stale_games_are_removed(self):
        model = PlayerModel([game(day) for day in range(1, 6)])
        fixture = lambda match_id, date, status="Scheduled": {"source_match_id": match_id, "scheduled_date": date,
            "status": status, "home": {"name": "Team A"}, "away": {"name": "Team B"}}
        schedule = [fixture("1", "2026-01-03", "Played"), fixture("2", "2026-01-08"), fixture("3", "2026-01-09")]
        with TemporaryDirectory() as directory:
            out = Path(directory)
            (out / "99.json").write_text("{}", encoding="utf-8")
            index = publish_packs(model, schedule, out, today="2026-01-08", games=1, simulations=20)
            first = (out / "2.json").read_bytes()
            publish_packs(model, schedule, out, today="2026-01-08", games=1, simulations=20)
            self.assertEqual([g["id"] for g in index], ["2"])
            self.assertEqual(sorted(p.name for p in out.iterdir()), ["2.json", "index.json"])
            self.assertEqual((out / "2.json").read_bytes(), first)


if __name__ == "__main__":
    unittest.main()


class TrackTests(unittest.TestCase):
    def pack(self, probability, date="2026-01-10"):
        return {"model": "test", "data_cutoff": "2026-01-01",
                "match": {"id": "7", "date": date, "time": "18:30:00", "home": {"id": "a"}, "away": {"id": "b"}},
                "summary": {"home_win_probability": probability, "mean_score": {"a": 80, "b": 75},
                            "margin": {"mean": 5, "p10": -8, "p90": 18}, "overtime_probability": 0.02},
                "players": [{"id": "a1", "name": "A One", "team": "a", "points": {"mean": 12, "p10": 6, "p90": 19}}]}

    def test_forecast_is_frozen_at_kickoff_and_scored_against_the_result(self):
        before = datetime(2026, 1, 10, 12, tzinfo=HELSINKI)
        archive = record_forecasts({}, [self.pack(0.6)], before)
        published = archive["7"]["published_at"]
        record_forecasts(archive, [self.pack(0.6)], before.replace(hour=13))
        self.assertEqual(archive["7"]["published_at"], published)  # Unchanged forecast, no churn.
        record_forecasts(archive, [self.pack(0.9)], datetime(2026, 1, 10, 19, tzinfo=HELSINKI))
        self.assertEqual(archive["7"]["home_win_probability"], 0.6)  # Kick-off has passed.
        record = {"game": {"source_id": "7"}, "teams": [
            {"source_id": "a", "score": 70, "players": [{"source_player_id": "a1", "stats": {"points": 25}}]},
            {"source_id": "b", "score": 72, "players": []}]}
        summary = summarize(attach_results(archive, [record]))
        self.assertEqual((summary["games"], summary["favourites_won"], summary["brier"]), (1, 0, 0.36))
        self.assertEqual(summary["player_interval_coverage"], 0.0)
