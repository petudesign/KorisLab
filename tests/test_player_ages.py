import unittest

from ingestion.publish_player_profiles import birth_year_value, public_birth_year, team_ages


def player(player_id, minutes):
    return {"source_player_id": player_id, "minutes": minutes}


class PlayerAgesTest(unittest.TestCase):
    def test_a_birth_year_is_public_only_once_the_player_is_surely_an_adult(self):
        self.assertEqual(public_birth_year(2007, 2026), 2007)
        self.assertIsNone(public_birth_year(2008, 2026))
        self.assertIsNone(public_birth_year(None, 2026))

    def test_invalid_birth_years_are_missing(self):
        self.assertEqual(birth_year_value({"birthyear": "1994"}), 1994)
        for value in ("0", "", None, "abc", "1800"):
            self.assertIsNone(birth_year_value({"birthyear": value}))

    def test_team_age_weights_by_minutes_and_reports_what_is_known(self):
        records = [{"teams": [{"name": "T", "players": [player("a", 30), player("b", 10), player("c", 40), player("d", 0)]}]}]
        ages = team_ages(records, {"a": 1996, "b": 2006}, "2026-27")["T"]
        self.assertEqual(ages["average_age"], 27.5)
        self.assertEqual(ages["roster_average_age"], 25.0)
        self.assertEqual(ages["known_minutes_share"], 0.5)
        self.assertEqual((ages["players_known"], ages["players"]), (2, 3))

    def test_a_team_with_no_known_ages_has_no_average(self):
        self.assertEqual(team_ages([{"teams": [{"name": "T", "players": [player("a", 30)]}]}], {}, "2026-27"), {})


if __name__ == "__main__":
    unittest.main()
