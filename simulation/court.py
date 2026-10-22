"""Court geometry for Basket.fi shot coordinates (0–100 along both axes, full court)."""
from math import hypot

LENGTH_M, WIDTH_M = 28.0, 15.0
HOOP_X = 1.575 / LENGTH_M * 100  # Hoop centre from the baseline, in percent of court length.
ZONES = ("rim", "paint", "midrange", "corner_three", "above_break_three")
THREE_ZONES = {"corner_three", "above_break_three"}


def to_left_half(x, y):
    """Rotate a location on the right half so every shot attacks the left basket."""
    return (100 - x, 100 - y) if x > 50 else (x, y)


def hoop_offset_m(x, y):
    """Metres from the attacked hoop: along the court (dx) and across it (dy)."""
    x, y = to_left_half(x, y)
    return (x - HOOP_X) * LENGTH_M / 100, (y - 50) * WIDTH_M / 100


def shot_zone(kind, x, y):
    if x is None or y is None:
        return "above_break_three" if kind == "3pt" else "rim"
    dx, dy = hoop_offset_m(x, y)
    if kind == "3pt":
        # FIBA corner threes sit on the straight line segment, 2.99 m from the baseline.
        return "corner_three" if dx < 1.6 else "above_break_three"
    if hypot(dx, dy) < 1.5:
        return "rim"
    if abs(dy) < 2.45 and dx < 4.25:
        return "paint"
    return "midrange"
