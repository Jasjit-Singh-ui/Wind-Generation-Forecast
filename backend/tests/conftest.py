"""Synthetic data builders shared by the tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pandas as pd
import pytest

from app import settings
from app.repository import WindData

# The real WINDFOR schedule in winter (UK local time == UTC).
PUBLISH_SLOTS = ("02:30", "04:30", "07:30", "09:30", "11:30", "15:30", "18:30", "22:30")


def ts(value: str) -> pd.Timestamp:
    return pd.Timestamp(value, tz="UTC")


def forecasts_frame(rows: list[tuple[str, str, float]]) -> pd.DataFrame:
    """Build a WINDFOR-like frame from ``(publish_time, start_time, generation_mw)`` tuples."""
    return pd.DataFrame(
        {
            "publish_time": [ts(p) for p, _, _ in rows],
            "start_time": [ts(s) for _, s, _ in rows],
            "generation_mw": [float(g) for _, _, g in rows],
        }
    )


def actuals_frame(points: dict[str, float]) -> pd.DataFrame:
    starts = [ts(s) for s in points]
    return pd.DataFrame(
        {
            "start_time": starts,
            "settlement_date": [s.strftime("%Y-%m-%d") for s in starts],
            "settlement_period": [s.hour * 2 + s.minute // 30 + 1 for s in starts],
            "generation_mw": list(points.values()),
            "publish_time": [s + timedelta(minutes=30) for s in starts],
        }
    )


def profile_mw(start_time: pd.Timestamp) -> float:
    """A deterministic hourly wind profile used by the synthetic window."""
    return 8_000.0 + 250.0 * start_time.hour


def synthetic_window(ratio: float = 0.9) -> WindData:
    """The full pilot window with the real run schedule, where outturn is always ``ratio`` x forecast.

    Every run forecasts the same value for a given hour, so whatever the decision time,
    the error-adjusted forecast should reproduce the outturn exactly.
    """
    first_day = settings.DATA_FIRST_PUBLISH_DATE
    last_day = settings.LAST_DELIVERY_DATE
    forecast_rows = []
    day = first_day
    while day <= settings.DATA_LAST_PUBLISH_DATE:
        midnight = pd.Timestamp(day.isoformat(), tz="UTC")
        targets = pd.date_range(midnight - timedelta(hours=3), midnight + timedelta(days=2, hours=21), freq="1h")
        for slot in PUBLISH_SLOTS:
            published = pd.Timestamp(f"{day.isoformat()}T{slot}", tz="UTC")
            forecast_rows += [(published, target, profile_mw(target)) for target in targets]
        day += timedelta(days=1)
    forecasts = pd.DataFrame(forecast_rows, columns=["publish_time", "start_time", "generation_mw"])

    half_hours = pd.date_range(
        pd.Timestamp(settings.DATA_FIRST_DELIVERY_DATE.isoformat(), tz="UTC"),
        pd.Timestamp((last_day + timedelta(days=1)).isoformat(), tz="UTC"),
        freq="30min",
        inclusive="left",
    )
    actuals = pd.DataFrame(
        {
            "start_time": half_hours,
            "settlement_date": half_hours.strftime("%Y-%m-%d"),
            "settlement_period": half_hours.hour * 2 + half_hours.minute // 30 + 1,
            "generation_mw": [ratio * profile_mw(t.floor("1h")) for t in half_hours],
            "publish_time": half_hours + timedelta(minutes=30),
        }
    )
    return WindData(actuals, forecasts, source="synthetic", fetched_at=datetime(2026, 2, 2, tzinfo=UTC))


@pytest.fixture(scope="session")
def synthetic_data() -> WindData:
    return synthetic_window(ratio=0.9)
