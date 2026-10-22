"""Parittainen viikkolohko-bootstrap: kehityskokeen eron vaihtelu, ei pelin CI."""

from collections import defaultdict
from datetime import datetime
from random import Random


def percentile(values, fraction):
    ordered = sorted(values)
    index = (len(ordered) - 1) * fraction
    low = int(index)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (index - low)


def bootstrap_difference(first, second, outcomes, repeats=5000, seed=20261013):
    """Palauta toisen mallin Brier miinus ensimmäisen, samoista otteluista.

    Viikon kaikki ottelut otetaan yhdessä, jotta niitä ei oleteta toisistaan
    riippumattomiksi. Eri viikkojen riippuvuudet eivät silti katoa tällä tavalla.
    Parametrit pidetään kiinteinä; tämä ei mittaa koko mallin sovitusepävarmuutta.
    """
    first_map = {prediction["match_id"]: prediction for prediction in first}
    second_map = {prediction["match_id"]: prediction for prediction in second}
    if len(first_map) != len(first) or len(second_map) != len(second):
        raise ValueError("Ennusteissa on kaksinkertaisia otteluita")
    if not first or first_map.keys() != second_map.keys():
        raise ValueError("Mallien otteluotokset eivät ole samat")
    if repeats < 100:
        raise ValueError("Vaihteluvälin arvio tarvitsee vähintään 100 toistoa")
    groups = defaultdict(list)
    for match_id, prediction in first_map.items():
        alternative = second_map[match_id]
        if prediction["date"] != alternative["date"]:
            raise ValueError("Ottelun ajat eivät täsmää")
        actual = outcomes[match_id]["home_won"]
        first_error = (prediction["home_win_probability"] - actual) ** 2
        second_error = (alternative["home_win_probability"] - actual) ** 2
        week = datetime.fromisoformat(prediction["date"]).isocalendar()[:2]
        groups[week].append(second_error - first_error)
    blocks = [(sum(values), len(values)) for _, values in sorted(groups.items())]
    random = Random(seed)
    differences = []
    for _ in range(repeats):
        selected = random.choices(blocks, k=len(blocks))
        differences.append(sum(block[0] for block in selected) / sum(block[1] for block in selected))
    return {
        "difference": sum(block[0] for block in blocks) / len(first),
        "lower": percentile(differences, 0.025), "upper": percentile(differences, 0.975),
        "weeks": len(blocks), "matches": len(first), "repeats": repeats, "seed": seed,
    }
