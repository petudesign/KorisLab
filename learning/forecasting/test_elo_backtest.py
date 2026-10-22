import copy
import unittest

from elo_backtest import evaluate, run_backtest
from confidence_groups import summarize_groups


def fixture(number, date, home="A", away="B", home_score=80, away_score=70):
    return {"id": str(number), "date": f"2025-10-{date:02}T18:00:00+03:00", "teams": [
        {"id": home, "name": home, "side": "home", "score": home_score},
        {"id": away, "name": away, "side": "away", "score": away_score},
    ]}


class BacktestTests(unittest.TestCase):
    def test_target_and_future_results_cannot_change_target_prediction(self):
        games = [fixture(i, i) for i in range(1, 8)]
        changed = copy.deepcopy(games)
        for match in changed[5:]:
            match["teams"][0]["score"] = 60
            match["teams"][1]["score"] = 90
        first, second = run_backtest(games), run_backtest(changed)
        self.assertEqual(first["predictions"][:6], second["predictions"][:6])
        self.assertNotEqual(first["predictions"][6], second["predictions"][6])

    def test_same_day_results_are_unavailable_and_order_does_not_matter(self):
        games = [fixture(1, 1), fixture(2, 1, home="A", away="C")]
        result = run_backtest(games)
        self.assertTrue(all(prediction["home_win_probability"] == 0.5 for prediction in result["predictions"]))
        self.assertEqual(result, run_backtest(list(reversed(games))))

    def test_sixth_match_is_deduplicated_and_rating_total_is_preserved(self):
        result = run_backtest([fixture(i, i) for i in range(1, 8)])
        sixth = [prediction for prediction in result["predictions"] if prediction["sixth_for"]]
        self.assertEqual(len(sixth), 1)
        self.assertEqual(sixth[0]["sixth_for"], ["A", "B"])
        self.assertAlmostEqual(sum(result["final_ratings"].values()), 3000)

    def test_missing_scores_and_duplicates_are_not_treated_as_results(self):
        with self.assertRaises(ValueError):
            run_backtest([fixture(1, 1, home_score=None)])
        with self.assertRaises(ValueError):
            run_backtest([fixture(1, 1), fixture(1, 2)])

    def test_flat_probability_brier_and_no_favorite(self):
        result = run_backtest([fixture(1, 1)])
        metrics = evaluate(result["predictions"], result["outcomes"])
        self.assertEqual(metrics["brier"], 0.25)
        self.assertEqual(metrics["favorites"], 0)
        self.assertEqual(metrics["ties"], 1)

    def test_group_boundaries_and_away_favorite(self):
        predictions = [{"match_id": str(index), "home_win_probability": probability}
                       for index, probability in enumerate([0.5, 0.54, 0.55, 0.65, 0.3])]
        outcomes = {str(index): {"home_won": int(index != 4)} for index in range(5)}
        groups = summarize_groups(predictions, outcomes)
        self.assertEqual([group["matches"] for group in groups], [1, 1, 2])
        self.assertEqual(groups[2]["wins"], 2)
        self.assertAlmostEqual(groups[2]["mean_probability"], 0.675)

    def test_empty_group_has_no_fabricated_zero_percent(self):
        groups = summarize_groups([], {})
        self.assertTrue(all(group["win_rate"] is None and group["brier"] is None for group in groups))

    def test_initial_ratings_change_first_prediction_without_mutating_input(self):
        initial = {"A": 1600, "B": 1400}
        result = run_backtest([fixture(1, 1)], initial_ratings=initial)
        self.assertGreater(result["predictions"][0]["home_win_probability"], 0.75)
        self.assertAlmostEqual(sum(result["final_ratings"].values()), 3000)
        self.assertEqual(initial, {"A": 1600, "B": 1400})

    def test_unknown_team_starts_neutral_and_invalid_prior_is_rejected(self):
        result = run_backtest([fixture(1, 1)], initial_ratings={"A": 1600})
        self.assertEqual(result["predictions"][0]["away_rating"], 1500)
        with self.assertRaises(ValueError):
            run_backtest([fixture(1, 1)], initial_ratings={"A": float("nan")})


if __name__ == "__main__":
    unittest.main()
