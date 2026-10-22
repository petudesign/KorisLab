"""Hallintasimulaattori: joukkueiden hallintojen tulokset suhteessa liigan tasoon.

Jokainen hallinta alkaa tavalla (esim. riisto tai vastustajan kori) ja päättyy
tulokseen, joka on (vastustajan seuraavan hallinnan alkutapa, pisteet).
Tuloksen todennäköisyys on liigan perustaso kerrottuna hyökkäävän joukkueen,
puolustavan joukkueen ja koti/vieras-puolen kertoimilla. Kertoimet kutistetaan
kohti yhtä, joten pieni otos ei tee joukkueesta ääripäätä. Ei kalibroitu tuotantomalli.
"""

from bisect import bisect
from collections import defaultdict
from datetime import datetime
from itertools import groupby
from math import exp
import random

STARTS = ("period_start", "made_fg", "made_ft", "defensive_rebound", "steal", "turnover")
MAX_POINTS = 4


def outcome_rows(possessions, home_id):
    """Muunna yhden ottelun hallinnat malliriveiksi.

    Erän loppuun katkenneet hallinnat jätetään pois: niiden tulos kertoo
    pelikellosta, ei joukkueista. Simulaattori käsittelee kellon erikseen.
    """
    rows = []
    for possession, following in zip(possessions, possessions[1:] + [None]):
        end = possession["end"]
        if end == "period_end":
            continue
        if end == "turnover":
            stolen = following and following["period"] == possession["period"] and following["start"] == "steal"
            next_start = "steal" if stolen else "turnover"
        elif end in ("made_fg", "made_ft", "defensive_rebound"):
            next_start = end
        else:
            next_start = "turnover"  # Kiinni otettu pallo tai hyökkääjän virhe: kuollut pallo.
        start = possession["start"] if possession["start"] in STARTS else "turnover"
        rows.append({"start": start, "outcome": (next_start, min(possession["points"], MAX_POINTS)),
                     "seconds": possession["seconds"], "offense": possession["offense"],
                     "defense": possession["defense"], "home_offense": possession["offense"] == home_id})
    return rows


class PossessionModel:
    def __init__(self, rows, prior=30, pace_prior=600):
        if not rows:
            raise ValueError("Mallilla ei ole hallintoja")
        self.prior, self.pace_prior = prior, pace_prior
        counts = defaultdict(lambda: defaultdict(int))
        durations = defaultdict(list)
        for row in rows:
            counts[row["start"]][row["outcome"]] += 1
            durations[(row["start"], row["outcome"][0])].append(row["seconds"])
        self.outcomes = sorted({row["outcome"] for row in rows})
        # Puolikas lisähavainto jokaiseen tulokseen estää nollatodennäköisyydet.
        self.base = {}
        for start in STARTS:
            total = sum(counts[start].values()) + 0.5 * len(self.outcomes)
            self.base[start] = {o: (counts[start][o] + 0.5) / total for o in self.outcomes}
        everything = [s for values in durations.values() for s in values]
        self.durations = {(start, o[0]): durations.get((start, o[0])) or everything
                          for start in STARTS for o in self.outcomes}
        mean_seconds = {key: sum(values) / len(values) for key, values in self.durations.items()}
        # Toteutunut ja liigatason odotettu määrä jokaiselle ryhmälle.
        self.observed = defaultdict(lambda: defaultdict(float))
        self.expected = defaultdict(lambda: defaultdict(float))
        for row in rows:
            groups = (("offense", row["offense"]), ("defense", row["defense"]),
                      ("side", "home" if row["home_offense"] else "away"))
            for group in groups:
                self.observed[group][row["outcome"]] += 1
                for outcome, probability in self.base[row["start"]].items():
                    self.expected[group][outcome] += probability
                self.observed[group]["seconds"] += row["seconds"]
                self.expected[group]["seconds"] += mean_seconds[(row["start"], row["outcome"][0])]

    def factor(self, group, key, prior):
        return (self.observed[group][key] + prior) / (self.expected[group][key] + prior)

    def weights(self, start, offense, defense, home_offense):
        groups = (("offense", offense), ("defense", defense), ("side", "home" if home_offense else "away"))
        weights = []
        for outcome in self.outcomes:
            weight = self.base[start][outcome]
            for group in groups:
                weight *= self.factor(group, outcome, self.prior)
            weights.append(weight)
        return weights

    def table(self, start, offense, defense, home_offense):
        return cumulate(self.outcomes, self.weights(start, offense, defense, home_offense))

    def pace(self, offense, defense):
        return (self.factor(("offense", offense), "seconds", self.pace_prior)
                * self.factor(("defense", defense), "seconds", self.pace_prior))


def cumulate(outcomes, weights, scoring_multiplier=1.0):
    cumulative, total = [], 0.0
    for outcome, weight in zip(outcomes, weights):
        total += weight * (scoring_multiplier if outcome[1] else 1)
        cumulative.append(total)
    return cumulative


def simulate(model, home, away, simulations=2000, seed=0, shock=0.0):
    """Pelaa ottelun hallinta kerrallaan pelikelloa vasten. Palauttaa jakauman tunnusluvut.

    `shock` on joukkueen ottelukohtaisen vireen keskihajonta log-asteikolla:
    jokaisessa simulaatiossa pisteitä tuottavien tulosten paino kerrotaan
    luvulla exp(N(0, shock)). Se kuvaa kertoimien epävarmuutta ja päivän vaihtelua.
    """
    rng = random.Random(seed)
    other = {home: away, away: home}
    weights = {(team, start): model.weights(start, team, other[team], team == home) for team in (home, away) for start in STARTS}
    fixed = {key: cumulate(model.outcomes, values) for key, values in weights.items()}
    pace = {team: model.pace(team, other[team]) for team in (home, away)}
    home_wins, margins, totals = 0, [], []
    for _ in range(simulations):
        tables = fixed
        if shock:
            form = {team: exp(rng.gauss(0, shock)) for team in (home, away)}
            tables = {key: cumulate(model.outcomes, values, form[key[0]]) for key, values in weights.items()}
        score = {home: 0, away: 0}
        first = home if rng.random() < 0.5 else away
        period = 1
        while True:
            remaining = 600 if period <= 4 else 300
            # Erät alkavat vuorotellen; jatkoerässä pallo arvotaan.
            offense = first if period % 2 else other[first]
            if period > 4:
                offense = home if rng.random() < 0.5 else away
            start = "period_start"
            while True:
                cumulative = tables[(offense, start)]
                outcome = model.outcomes[bisect(cumulative, rng.random() * cumulative[-1])]
                seconds = rng.choice(model.durations[(start, outcome[0])]) * pace[offense]
                if seconds >= remaining:
                    break  # Kello loppuu kesken hallinnan.
                remaining -= seconds
                score[offense] += outcome[1]
                start, offense = outcome[0], other[offense]
            if period >= 4 and score[home] != score[away]:
                break
            period += 1
        home_wins += score[home] > score[away]
        margins.append(score[home] - score[away])
        totals.append(score[home] + score[away])
    return {"home_win_probability": home_wins / simulations,
            "mean_margin": sum(margins) / simulations, "mean_total": sum(totals) / simulations}


def walk_forward(matches, games_by_match, simulations=2000, prior=30, pace_prior=600, shock=0.0):
    """Simuloi aikajärjestetyt ottelut käyttäen vain aiempien päivien hallintoja."""
    simulated, rows = {}, []
    for _, day in groupby(matches, key=lambda match: datetime.fromisoformat(match["date"]).date()):
        day = list(day)
        model = PossessionModel(rows, prior, pace_prior) if rows else None
        for match in day:
            teams = {team["side"]: team["id"] for team in match["teams"]}
            simulated[match["id"]] = (simulate(model, teams["home"], teams["away"], simulations, shock=shock) if model
                                      else {"home_win_probability": 0.5, "mean_margin": 0, "mean_total": None})
        for match in day:
            if match["id"] in games_by_match:
                home = next(team["id"] for team in match["teams"] if team["side"] == "home")
                rows.extend(outcome_rows(games_by_match[match["id"]], home))
    return simulated
