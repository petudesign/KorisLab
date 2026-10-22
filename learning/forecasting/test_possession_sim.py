import unittest

from possession_sim import PossessionModel, outcome_rows, simulate


def possession(offense, start, end, points, period=1, seconds=15):
    return {"offense": offense, "defense": "b" if offense == "a" else "a", "start": start, "end": end,
            "points": points, "period": period, "seconds": seconds}


def season():
    """Vuorottelevat hallinnat, joissa a tekee aina kolme pistettä ja b kaksi."""
    rows = []
    for _ in range(40):
        game = []
        for _ in range(40):
            game.append(possession("a", "made_fg", "made_fg", 3))
            game.append(possession("b", "made_fg", "made_fg", 2))
        rows.extend(outcome_rows(game, "a"))
    return rows


class PossessionSimTests(unittest.TestCase):
    def test_outcome_rows_split_steals_and_drop_period_ends(self):
        game = [possession("a", "period_start", "turnover", 0), possession("b", "steal", "turnover", 0),
                possession("a", "turnover", "made_ft", 5), possession("b", "jump_ball", "period_end", 0)]
        rows = outcome_rows(game, "a")
        self.assertEqual([(r["start"], r["outcome"]) for r in rows],
                         [("period_start", ("steal", 0)), ("steal", ("turnover", 0)), ("turnover", ("made_ft", 4))])
        self.assertEqual([r["home_offense"] for r in rows], [True, False, True])

    def test_unseen_team_gets_league_factors(self):
        model = PossessionModel(season())
        self.assertEqual(model.factor(("offense", "unknown"), ("made_fg", 3), model.prior), 1)
        self.assertGreater(model.factor(("offense", "a"), ("made_fg", 3), model.prior), 1)

    def test_simulation_is_reproducible_and_separates_teams(self):
        model = PossessionModel(season())
        first = simulate(model, "a", "b", simulations=200, seed=4)
        self.assertEqual(first, simulate(model, "a", "b", simulations=200, seed=4))
        self.assertGreater(first["home_win_probability"], 0.9)
        weak = simulate(model, "b", "a", simulations=200, seed=4)
        self.assertLess(weak["home_win_probability"], 0.1)

    def test_empty_history_is_rejected(self):
        with self.assertRaises(ValueError):
            PossessionModel([])


if __name__ == "__main__":
    unittest.main()
