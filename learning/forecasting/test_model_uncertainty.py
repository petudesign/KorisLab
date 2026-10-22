import unittest

from model_uncertainty import bootstrap_difference


class UncertaintyTests(unittest.TestCase):
    def test_identical_models_have_zero_difference_and_interval(self):
        predictions = [{"match_id": "1", "date": "2025-10-01T18:00:00+03:00", "home_win_probability": 0.6}]
        result = bootstrap_difference(predictions, predictions, {"1": {"home_won": 1}}, repeats=100)
        self.assertEqual([result[key] for key in ["difference", "lower", "upper"]], [0, 0, 0])

    def test_difference_direction_and_reproducibility(self):
        first = [{"match_id": "1", "date": "2025-10-01T18:00:00+03:00", "home_win_probability": 0.5}]
        second = [{**first[0], "home_win_probability": 0.8}]
        outcomes = {"1": {"home_won": 1}}
        result = bootstrap_difference(first, second, outcomes, repeats=100)
        self.assertAlmostEqual(result["difference"], -0.21)
        self.assertEqual(result, bootstrap_difference(first, second, outcomes, repeats=100))

    def test_mismatched_or_duplicate_samples_are_rejected(self):
        first = [{"match_id": "1", "date": "2025-10-01T18:00:00+03:00", "home_win_probability": 0.5}]
        with self.assertRaises(ValueError):
            bootstrap_difference(first, [], {}, repeats=100)
        with self.assertRaises(ValueError):
            bootstrap_difference(first + first, first, {}, repeats=100)


if __name__ == "__main__":
    unittest.main()
