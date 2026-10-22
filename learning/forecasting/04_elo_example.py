"""Elo-kokeilu kuvitteellisilla joukkueilla, ei oikea otteluennuste.

Aja: python3 learning/forecasting/04_elo_example.py
400 ja K=32 ovat harjoituksen valintoja, eivät Korisliigalla testattuja arvoja.
Mukana ei vielä ole kotietua, kokoonpanoja tai voittomarginaalia.
"""

from math import isclose


def expected_win(rating, opponent_rating):
    return 1 / (1 + 10 ** ((opponent_rating - rating) / 400))


def rating_change(expected, won, k=32):
    actual = 1 if won else 0
    return k * (actual - expected)


if __name__ == "__main__":
    favorite_rating = 1600
    underdog_rating = 1400
    favorite_expected = expected_win(favorite_rating, underdog_rating)

    print("Kuvitteellinen esimerkki · molemmissa vaihtoehdoissa sama lähtötilanne")
    print(f"Suosikin vahvuusluku: {favorite_rating}")
    print(f"Altavastaajan vahvuusluku: {underdog_rating}")
    print(f"Kaavan antama suosikin voitto-odotus: {favorite_expected:.1%}")

    for favorite_won in [True, False]:
        change = rating_change(favorite_expected, favorite_won)
        new_favorite = favorite_rating + change
        new_underdog = underdog_rating - change

        print("\nSuosikki voittaa" if favorite_won else "Altavastaaja voittaa")
        print(f"  Suosikki:      {favorite_rating} → {new_favorite:.1f} ({change:+.1f})")
        print(f"  Altavastaaja:  {underdog_rating} → {new_underdog:.1f} ({-change:+.1f})")

    # Mallin perusominaisuuksia, ei näyttöä ennustetarkkuudesta.
    assert expected_win(1500, 1500) == 0.5
    assert isclose(favorite_expected + expected_win(underdog_rating, favorite_rating), 1)
    assert abs(rating_change(favorite_expected, False)) > abs(
        rating_change(favorite_expected, True)
    )
    print("\nVahvuusluvut eivät ole ottelupisteitä. Esimerkkiä ei ole kalibroitu liigalle.")
