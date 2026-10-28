"""UK local-time helpers.

Elexon publishes timestamps in UTC, but the market works in UK local time: a delivery
(settlement) day runs from 00:00 to 24:00 Europe/London, which is 23 or 25 hours long on
clock-change days, and auction gate closures are quoted in local time.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pandas as pd

UK_TZ = ZoneInfo("Europe/London")


def local_midnight_utc(day: date) -> pd.Timestamp:
    """The UTC instant at which a UK local day starts."""
    return pd.Timestamp(datetime.combine(day, time(0), tzinfo=UK_TZ)).tz_convert("UTC")


def delivery_day_bounds(day: date) -> tuple[pd.Timestamp, pd.Timestamp]:
    """UTC ``[start, end)`` of a UK delivery day."""
    return local_midnight_utc(day), local_midnight_utc(day + timedelta(days=1))


def decision_cutoff(delivery_day: date, decision_time: time) -> pd.Timestamp:
    """UTC instant of the purchase decision for ``delivery_day``: ``decision_time`` on D-1."""
    decision_day = delivery_day - timedelta(days=1)
    return pd.Timestamp(datetime.combine(decision_day, decision_time, tzinfo=UK_TZ)).tz_convert("UTC")


def uk_date(timestamps: pd.Series) -> pd.Series:
    """UK local calendar date of each UTC timestamp."""
    return timestamps.dt.tz_convert(UK_TZ).dt.date


def uk_hour(timestamps: pd.Series) -> pd.Series:
    """UK local hour of day (0-23) of each UTC timestamp."""
    return timestamps.dt.tz_convert(UK_TZ).dt.hour


def parse_hhmm(value: str) -> time:
    """Parse ``"HH:MM"`` (24h clock) into a :class:`datetime.time`."""
    try:
        hours, minutes = value.split(":")
        return time(int(hours), int(minutes))
    except ValueError as exc:  # wrong shape, non-numeric or out of range
        raise ValueError(f"Expected a time as HH:MM, got {value!r}") from exc


def format_hhmm(value: time) -> str:
    return value.strftime("%H:%M")


def date_range(first: date, last: date) -> list[date]:
    """Inclusive list of calendar days."""
    return [first + timedelta(days=i) for i in range((last - first).days + 1)]
