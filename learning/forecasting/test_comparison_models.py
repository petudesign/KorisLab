import copy
import unittest

from comparison_models import fit_logistic, margin_features, sigmoid
from elo_backtest import run_backtest
from test_elo_backtest import fixture


class ComparisonTests(unittest.TestCase):
    def test_margin_features_do_not_read_target_or_future_scores(self):
        games = [fixture(i, i) for i in range(1, 8)]
        changed = copy.deepcopy(games)
        for match in changed[5:]:
            match["teams"][0]["score"] = 30
        original, _ = margin_features(games)
        altered, _ = margin_features(changed)
        self.assertEqual(original[:6], altered[:6])
        self.assertNotEqual(original[6], altered[6])

    def test_same_day_margin_is_unavailable(self):
        rows, _ = margin_features([fixture(1, 1), fixture(2, 1, home="A", away="C")])
        self.assertEqual([row["margin_feature"] for row in rows], [0, 0])

    def test_fit_reaches_penalized_logistic_stationary_point(self):
        samples = [(-2, 0), (-1, 0), (0, 1), (1, 1), (2, 1)]
        fit = fit_logistic(samples)
        bias_gradient, slope_gradient = fit["bias"], fit["slope"]
        for value, actual in samples:
            residual = sigmoid(fit["bias"] + fit["slope"] * value) - actual
            bias_gradient += residual
            slope_gradient += residual * value
        self.assertAlmostEqual(bias_gradient, 0, places=6)
        self.assertAlmostEqual(slope_gradient, 0, places=6)
        self.assertGreater(fit["slope"], 0)

    def test_neutral_mirrored_fit_and_stable_extreme_probabilities(self):
        samples = [(2, 1), (-1, 0), (1, 0)]
        mirrored = samples + [(-value, 1-actual) for value, actual in samples]
        self.assertAlmostEqual(fit_logistic(mirrored)["bias"], 0)
        self.assertEqual(sigmoid(1000), 1)
        self.assertEqual(sigmoid(-1000), 0)

    def test_half_weighted_duplicate_training_preserves_regularization(self):
        samples = [(-2, 0), (-1, 0), (1, 1), (2, 1)]
        fit = fit_logistic(samples)
        duplicate_fit = fit_logistic(samples + samples, sample_weight=0.5)
        self.assertAlmostEqual(fit["slope"], duplicate_fit["slope"])
        self.assertAlmostEqual(fit["bias"], duplicate_fit["bias"])

    def test_home_correction_affects_expectation_and_update_consistently(self):
        games = [fixture(1, 1)]
        baseline = run_backtest(games)
        corrected = run_backtest(games, home_logodds=0.2)
        self.assertGreater(corrected["predictions"][0]["home_win_probability"], 0.5)
        self.assertLess(corrected["final_ratings"]["A"], baseline["final_ratings"]["A"])
        self.assertAlmostEqual(sum(corrected["final_ratings"].values()), 3000)


if __name__ == "__main__":
    unittest.main()
