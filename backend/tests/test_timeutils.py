from datetime import date, time

import pytest

from app.timeutils import decision_cutoff, delivery_day_bounds, parse_hhmm
from tests.conftest import ts


@pytest.mark.parametrize(
    ("day", "hours"),
    [
        (date(2026, 1, 15), 24),  # GMT
        (date(2026, 3, 29), 23),  # clocks go forward
        (date(2026, 10, 25), 25),  # clocks go back
    ],
)
def test_delivery_day_length_follows_uk_clock_changes(day, hours):
    start, end = delivery_day_bounds(day)
    assert (end - start).total_seconds() == hours * 3600


def test_delivery_day_starts_at_uk_midnight():
    assert delivery_day_bounds(date(2026, 1, 15))[0] == ts("2026-01-15T00:00")
    assert delivery_day_bounds(date(2026, 7, 15))[0] == ts("2026-07-14T23:00")  # BST = UTC+1


def test_decision_cutoff_is_on_the_previous_uk_day():
    assert decision_cutoff(date(2026, 1, 15), time(9, 20)) == ts("2026-01-14T09:20")
    assert decision_cutoff(date(2026, 7, 15), time(9, 20)) == ts("2026-07-14T08:20")


def test_parse_hhmm():
    assert parse_hhmm("09:20") == time(9, 20)
    for bad in ("9", "24:00", "ab:cd", "09:60"):
        with pytest.raises(ValueError):
            parse_hhmm(bad)
