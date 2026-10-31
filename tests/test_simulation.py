from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from simulation.court import shot_zone, to_left_half
from simulation.export import publish_packs
from simulation import player_sim
from simulation.player_sim import GameSimulator, PlayerModel, offensive_chances
from simulation.error_analysis import continuity, decomposition
from simulation.evaluate import walk_forward
from simulation.track import HELSINKI, attach_results, record_forecasts, summarize
from simulation.tune import evaluable
from simulation.win_probability import game_states, home_win_probability, seconds_left


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


class EvaluationTests(unittest.TestCase):
    def test_walk_forward_uses_only_earlier_days_and_keeps_margins(self):
        games = [game(day) for day in range(1, 5)]
        for g in games:
            for team, score in zip(g["record"]["teams"], (90, 70)):
                team["score"] = score
        out = walk_forward([], games, simulations=20, workers=2)
        self.assertNotIn("1", out)  # Nothing earlier to learn from on the first day.
        self.assertEqual(set(out), {"2", "3", "4"})
        self.assertGreater(out["4"]["home_win_probability"], 0.5)
        self.assertLessEqual(out["4"]["margin_p10"], out["4"]["mean_margin"])
        self.assertLessEqual(out["4"]["mean_margin"], out["4"]["margin_p90"])
        self.assertEqual(out, walk_forward([], games, simulations=20, workers=1))

    def test_evaluable_games_need_five_earlier_games_for_both_teams(self):
        games = [game(day) for day in range(1, 9)]
        self.assertEqual(evaluable(games), {"6", "7", "8"})

    def test_decomposition_and_continuity(self):
        perfect = [{"p": 1.0, "home_won": 1}, {"p": 0.0, "home_won": 0}]
        result = decomposition(perfect, "p")
        self.assertEqual(result["reliability"], 0)
        self.assertEqual(result["resolution"], result["uncertainty"])
        before, after = record(), record()
        after["teams"][1]["players"] = [{**p, "source_player_id": "new" + p["source_player_id"]} for p in after["teams"][1]["players"]]
        kept = continuity([before], [after])
        self.assertEqual(kept["a"], 1.0)
        self.assertEqual(kept["b"], 0.0)


class FormTests(unittest.TestCase):
    def setUp(self):
        self.simulator = GameSimulator(PlayerModel([game(day) for day in range(1, 6)]), "a", "b")
        self.saved = dict(player_sim.FORM)

    def tearDown(self):
        player_sim.FORM.update(self.saved)

    def test_zero_form_changes_nothing(self):
        before = [self.simulator.play(seed)["score"] for seed in range(20)]
        player_sim.FORM.update({"shot": 0.0, "usage": 0.0, "defense": 0.0})
        self.assertEqual(before, [self.simulator.play(seed)["score"] for seed in range(20)])
        self.assertEqual(set(self.simulator.form["shot"].values()), {1.0})

    def test_form_widens_a_shooters_range(self):
        def spread():
            points = [self.simulator.play(seed)["stats"].get("a1", {}).get("points", 0) for seed in range(150)]
            mean = sum(points) / len(points)
            return (sum((p - mean) ** 2 for p in points) / len(points)) ** 0.5
        narrow = spread()
        player_sim.FORM.update({"shot": 0.3, "usage": 0.3})
        self.assertGreater(spread(), narrow)


class GameStoryTests(unittest.TestCase):
    def rows(self):
        shot = {"type": "2pt", "team": "H", "player": "p1", "clock": 500.0, "made": True, "x": 10, "y": 60}
        assist = {"type": "assist", "team": "H", "player": "p2", "clock": 500.0}
        loss = {"type": "turnover", "team": "H", "player": "p2", "clock": 480.0}
        steal = {"type": "steal", "team": "A", "player": "p3", "clock": 480.0}
        free_throws = [{"type": "free_throw", "team": "A", "player": "p3", "clock": 400.0, "made": True, "subtype": "1Of2"}, {"type": "free_throw", "team": "A", "player": "p3", "clock": 400.0, "made": False, "subtype": "2Of2"}]
        row = lambda event, h, a: {"period": 1, "clock": event["clock"], "elapsed": 600 - event["clock"], "event": event, "home_points": h, "away_points": a, "wp": 0.5}
        return [row(shot, 2, 0), row(assist, 2, 0), row(loss, 2, 0), row(steal, 2, 0), row(free_throws[0], 2, 1), row(free_throws[1], 2, 1)]

    def test_one_moment_is_one_line_and_time_only_moves_forward(self):
        from simulation.game_story import replay_events
        events = replay_events(self.rows(), "H", {"p1": "Yksi", "p2": "Kaksi", "p3": "Kolme"})
        self.assertEqual([e["k"] for e in events], ["2pt", "steal", "free_throw", "free_throw"])
        self.assertEqual(events[0]["as"], "Kaksi")
        self.assertEqual((events[1]["n"], events[1]["lost"], events[1]["s"]), ("Kolme", "Kaksi", "a"))
        self.assertTrue(all(a["t"] < b["t"] for a, b in zip(events, events[1:])))

    def test_home_end_follows_the_home_shots(self):
        from simulation.game_story import attacking_ends
        shot = lambda team, x: {"type": "2pt", "team": team, "x": x}
        game = {"home": "H", "possessions": [{"period": 1, "events": [shot("H", 5), shot("A", 95)]}, {"period": 3, "events": [shot("H", 95), shot("H", 90), shot("A", 8)]}]}
        self.assertEqual(attacking_ends(game), {"1": "L", "3": "R"})

    def test_every_game_of_the_season_builds_and_reaches_its_final(self):
        from simulation.game_story import build_story, locked_params
        from simulation.win_probability import expected_inputs, load
        games, _ = load("men", "2025-26")
        gaps, params = expected_inputs(games), locked_params("men")
        for game in games:
            story = build_story(game, gaps[game["match_id"]], "men", "2025-26", params)
            self.assertEqual((story["events"][-1]["h"], story["events"][-1]["a"]), (story["home"]["score"], story["away"]["score"]))
            self.assertTrue(all(a["t"] < b["t"] for a, b in zip(story["events"], story["events"][1:])))


class PowerRatingTests(unittest.TestCase):
    def test_worked_example_matches_the_site(self):
        from simulation.power_rating import fit
        ratings, variance = fit([("A", "B", 10)], 1, 0)
        self.assertAlmostEqual(ratings["A"], 10 / 3)
        self.assertAlmostEqual(ratings["B"], -10 / 3)
        self.assertAlmostEqual(variance["A"], 2 / 3)

    def test_a_game_is_never_predicted_from_its_own_day(self):
        from simulation.power_rating import gaps
        record = lambda a, b, x, y: {"record": {"teams": [{"source_id": a, "score": x}, {"source_id": b, "score": y}]}, "home": a}
        games = [{**record("A", "B", 90, 70), "date": f"2025-01-{d:02d}", "match_id": str(d)} for d in range(1, 7)] + [{**record("A", "B", 50, 90), "date": "2025-01-07", "match_id": "7"}]
        rows = gaps(games, lambda results, shrink, home: ({"A": len(results), "B": 0}, None), 1, 0)
        self.assertEqual([(m, g) for m, g, _ in rows], [("6", 5), ("7", 6)])


class WinProbabilityTests(unittest.TestCase):
    def test_probability_follows_margin_clock_and_expectation(self):
        self.assertEqual(home_win_probability(3, 0, 0, 14), 1.0)
        self.assertEqual(home_win_probability(0, 0, 0, 14), 0.5)
        self.assertGreater(home_win_probability(6, 120, 0, 14), home_win_probability(6, 1800, 0, 14))
        self.assertGreater(home_win_probability(0, 2400, 4, 14), 0.5)
        self.assertEqual(seconds_left(11, 120), 120)

    def test_states_cross_quarters_inside_a_possession_and_end_on_the_real_score(self):
        record = {"game": {"periods": [{"period": 1, "home_score": 3, "away_score": 2}, {"period": 2, "home_score": 2, "away_score": 0}]},
                  "teams": [{"source_id": "a", "score": 5}, {"source_id": "b", "score": 2}]}
        possessions = [{"period": 1, "events": [{"type": "2pt", "team": "a", "made": True, "clock": 300.0}, {"type": "2pt", "team": "b", "made": True, "clock": 200.0}]},
                       {"period": 1, "events": [{"type": "foul", "team": "b", "clock": 1.0}, {"type": "2pt", "team": "a", "made": True, "clock": 590.0}]}]
        states = game_states({"record": record, "home": "a", "possessions": possessions})
        scored = [s for s in states if s[4] and s[4]["type"] == "2pt"]
        self.assertEqual([s[0] for s in scored], [1, 1, 2])
        self.assertEqual(states[-1][3], 3)  # The technical point in quarter one is settled at its end, and the final matches.
        self.assertEqual(next(s for s in states if s[0] == 2)[3], 1)
