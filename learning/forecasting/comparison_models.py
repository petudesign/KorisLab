"""Piste-erolähtötaso ja pieni logistinen sovitus Pythonin standardikirjastolla."""

from collections import defaultdict
from datetime import datetime
from itertools import groupby
from math import exp, log

from elo_backtest import checked_matches


def sigmoid(value):
    if value >= 0:
        return 1 / (1 + exp(-value))
    value_exp = exp(value)
    return value_exp / (1 + value_exp)


def margin_features(matches):
    totals, counts = defaultdict(float), defaultdict(int)
    rows, outcomes = [], {}
    for _, day in groupby(checked_matches(matches), key=lambda game: datetime.fromisoformat(game["date"]).date()):
        day = list(day)
        for game in day:
            teams = {team["side"]: team for team in game["teams"]}
            home, away = teams["home"], teams["away"]
            # Viiden nollamarginaalisen lähtöpelin paino hillitsee pientä otosta.
            home_margin = totals[home["id"]] / (counts[home["id"]] + 5)
            away_margin = totals[away["id"]] / (counts[away["id"]] + 5)
            rows.append({"match_id": game["id"], "margin_feature": (home_margin - away_margin) / 10,
                         "both_have_five": counts[home["id"]] >= 5 and counts[away["id"]] >= 5})
        for game in day:
            teams = {team["side"]: team for team in game["teams"]}
            home, away = teams["home"], teams["away"]
            margin = home["score"] - away["score"]
            totals[home["id"]] += margin
            totals[away["id"]] -= margin
            counts[home["id"]] += 1
            counts[away["id"]] += 1
            outcomes[game["id"]] = {"home_won": int(margin > 0)}
    return rows, outcomes


def fit_logistic(samples, fit_slope=True, sample_weight=1):
    """Sovita bias ja haluttaessa kulmakerroin. L2=1, myös biasille.

    Näyte on (x, toteuma). Jos kulmakerrointa ei soviteta, x on jo valmiin
    Elo-arvion log-odds ja sovitetaan vain kotipaikkakorjaus.
    """
    if not samples:
        raise ValueError("Sovitukseen ei ole otteluita")
    slope, bias = (0.0 if fit_slope else 1.0), 0.0
    for _ in range(100):
        gradient_bias, gradient_slope = bias, slope if fit_slope else 0
        h_bb, h_ss, h_bs = 1.0, 1.0, 0.0
        for value, actual in samples:
            probability = sigmoid(bias + slope * value)
            residual = sample_weight * (probability - actual)
            variance = sample_weight * probability * (1 - probability)
            gradient_bias += residual
            h_bb += variance
            if fit_slope:
                gradient_slope += residual * value
                h_ss += variance * value * value
                h_bs += variance * value
        if fit_slope:
            determinant = h_bb * h_ss - h_bs * h_bs
            step_bias = (h_ss * gradient_bias - h_bs * gradient_slope) / determinant
            step_slope = (h_bb * gradient_slope - h_bs * gradient_bias) / determinant
        else:
            step_bias, step_slope = gradient_bias / h_bb, 0
        # Maltillinen askel Newtonin suuntaan.
        bias -= 0.5 * step_bias
        slope -= 0.5 * step_slope
        if abs(step_bias) + abs(step_slope) < 1e-8:
            return {"slope": slope, "bias": bias}
    raise ValueError("Sovitus ei saavuttanut asetettua toleranssia")


def elo_bias_samples(predictions, outcomes):
    return [(log(p["home_win_probability"] / (1 - p["home_win_probability"])), outcomes[p["match_id"]]["home_won"])
            for p in predictions if p["both_have_five"]]
