import copy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from ingestion.publish_onoff import publish
from normalization.basketfi_onoff import STATS, clock_seconds, reconstruct_game


def fixture():
    def player(tid, index):
        minutes = (35 if index == 1 else 5 if index == 6 else 40) if tid == "a" else (0 if index == 6 else 40)
        plus = (2 if index == 1 else -3 if index == 6 else -1) if tid == "a" else (0 if index == 6 else 1)
        return {"source_player_id": f"{tid}{index}", "starter": index <= 5, "minutes": minutes,
                "participated": minutes > 0, "stats": {"plus_minus": plus}}
    teams = []
    for tid in ("a", "b"):
        stats = dict.fromkeys(STATS, 0)
        stats.update({"points": 2 if tid == "a" else 3, "two_pm": int(tid == "a"), "two_pa": int(tid == "a"),
                      "three_pm": int(tid == "b"), "three_pa": int(tid == "b")})
        teams.append({"source_id": tid, "stats": stats, "players": [player(tid, i) for i in range(1, 7)]})
    record = {"game": {"source_id": "game", "periods": [{"period": i} for i in range(1, 5)]}, "teams": teams}
    event_id = 0
    def event(period, clock, tid, pid, kind, subtype=None, success=None):
        nonlocal event_id
        event_id += 1
        return {"eventId": str(event_id), "periodId": period, "clock": clock,
                "entityId": tid, "personId": pid, "eventType": kind, "eventSubType": subtype, "success": success}
    periods = {str(i): {"ended": True, "events": []} for i in range(1, 5)}
    periods["1"]["events"] = [event(1, "PT08M0S", "a", "a1", "2pt", success=True),
        event(1, "PT05M0S", "a", "a1", "substitution", "out"), event(1, "PT05M0S", "a", "a6", "substitution", "in"),
        event(1, "PT04M0S", "b", "b1", "3pt", success=True)]
    periods["2"]["events"] = [event(2, "PT10M0S", "a", "a6", "substitution", "out"), event(2, "PT10M0S", "a", "a1", "substitution", "in")]
    payload = {"data": {"banner": {"fixture": {"competitors": [{"entityId": "a"}, {"entityId": "b"}]}}, "pbp": periods}}
    return payload, record


class OnOffTests(unittest.TestCase):
    def test_lineup_changes_and_score_conservation(self):
        payload, record = fixture()
        states, totals, seconds = reconstruct_game(payload, record)
        self.assertEqual(seconds, 2400)
        self.assertEqual(states["a"]["a1"]["on"]["seconds"], 2100)
        self.assertEqual(states["a"]["a6"]["on"]["seconds"], 300)
        self.assertEqual(states["a"]["a1"]["on"]["own"]["points"], 2)
        self.assertEqual(states["a"]["a1"]["off"]["opponent"]["points"], 3)
        for tid, players in states.items():
            self.assertEqual(sum(p["on"]["seconds"] for p in players.values()), 5 * seconds)
            for pair in players.values():
                self.assertEqual(pair["on"]["seconds"] + pair["off"]["seconds"], seconds)
                for key in STATS:
                    self.assertEqual(pair["on"]["own"][key] + pair["off"]["own"][key], totals[tid][key])

    def test_bad_lineups_minutes_and_plus_minus_are_rejected(self):
        mutations = [lambda p, r: r["teams"][0]["players"][0].update(starter=False),
            lambda p, r: r["teams"][0]["players"][0].update(minutes=36),
            lambda p, r: r["teams"][0]["players"][0]["stats"].update(plus_minus=1),
            lambda p, r: r["teams"][0]["stats"].update(points=3),
            lambda p, r: p["data"]["pbp"]["1"].update(ended=False),
            lambda p, r: p["data"]["pbp"]["1"]["events"][2].update(personId="a2"),
            lambda p, r: p["data"]["pbp"]["1"]["events"][3].update(personId="b6"),
            lambda p, r: p["data"]["pbp"]["1"]["events"][1].update(eventId="1")]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                payload, record = fixture()
                mutate(payload, record)
                with self.assertRaises(ValueError):
                    reconstruct_game(payload, record)

    def test_optional_mismatches_and_unknown_minutes_are_not_zero(self):
        payload, record = fixture()
        record["teams"][0]["stats"]["rebounds"] = None
        record["teams"][1]["players"][5]["minutes"] = None
        states, _, _ = reconstruct_game(payload, record)
        self.assertIsNone(states["a"]["a1"]["on"]["own"]["rebounds"])
        self.assertIsNone(states["b"]["b1"]["off"]["opponent"]["rebounds"])
        record["teams"][1]["players"][5]["participated"] = None
        with self.assertRaisesRegex(ValueError, "Unknown player participation"):
            reconstruct_game(payload, record)

    def test_publisher_excludes_the_whole_bad_game(self):
        payload, good = fixture()
        bad = copy.deepcopy(good)
        bad["game"]["source_id"] = "bad"
        bad["teams"][0]["players"][0]["starter"] = False
        with TemporaryDirectory() as directory:
            cache = Path(directory)
            for name in ("game", "bad"):
                (cache / f"{name}.json").write_text(json.dumps(payload), encoding="utf-8")
            result = publish([good, bad], cache)
        self.assertEqual(result["verified_games"], 1)
        self.assertEqual(result["expected_games"], 2)
        self.assertEqual(result["match_ids"], ["game"])
        self.assertEqual(result["excluded"][0]["match_id"], "bad")
        self.assertTrue(all(row["games"] == 1 for row in result["players"]))

    def test_published_real_sample_is_reproducible(self):
        root = Path(__file__).resolve().parents[1]
        records = json.loads((root / "data/normalized/season_verified.json").read_text(encoding="utf-8"))["matches"]
        snapshot = json.loads((root / "web/public/onoff-2025-26.json").read_text(encoding="utf-8"))
        cache = root / "data/cache/pbp"
        if not all(
            (cache / f"{record['game']['source_id']}.json").is_file()
            for record in records
        ):
            self.skipTest("The local-only play-by-play cache is unavailable in this environment")
        result = publish(records, cache)
        self.assertEqual(result, snapshot)
        self.assertGreater(result["verified_games"], 0)
        self.assertNotIn("968921", result["match_ids"])

    def test_clock_validation(self):
        self.assertEqual(clock_seconds("PT9M3S"), 543)
        with self.assertRaises(ValueError):
            clock_seconds("9:03")


if __name__ == "__main__":
    unittest.main()
