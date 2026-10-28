"""Which forecast was available when the purchase decision was made.

The day-ahead decision for delivery day D is taken on D-1 at a configurable UK local time
(by default the first auction gate closure). For every target hour of D we use the latest
WINDFOR value published *strictly before* that cutoff. Runs are selected per target hour,
so an irregular, late or missing run simply falls back to the previous one.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, time

import pandas as pd

from .timeutils import decision_cutoff, delivery_day_bounds, uk_date

DECISION_COLUMNS = [
    "delivery_date",
    "start_time",
    "publish_time",
    "cutoff",
    "lead_hours",
    "forecast_mw",
]


def decision_forecasts(forecasts: pd.DataFrame, delivery_days: Iterable[date], decision_time: time) -> pd.DataFrame:
    """The forecast that was available at the decision, for every target hour of each day.

    Returns one row per target hour with :data:`DECISION_COLUMNS`. Hours that no run
    published before the cutoff covers are absent (callers can count coverage).
    ``forecasts`` may carry a precomputed ``delivery_date`` column (see :func:`with_delivery_date`).
    """
    days = pd.DataFrame({"delivery_date": list(delivery_days)})
    if days.empty or forecasts.empty:
        return pd.DataFrame(columns=DECISION_COLUMNS)
    days["cutoff"] = [decision_cutoff(day, decision_time) for day in days["delivery_date"]]

    candidates = with_delivery_date(forecasts).merge(days, on="delivery_date")
    candidates = candidates[candidates["publish_time"] < candidates["cutoff"]]
    if candidates.empty:
        return pd.DataFrame(columns=DECISION_COLUMNS)

    latest = candidates.loc[candidates.groupby("start_time")["publish_time"].idxmax()]
    latest = latest.rename(columns={"generation_mw": "forecast_mw"})
    latest["lead_hours"] = (latest["start_time"] - latest["publish_time"]).dt.total_seconds() / 3600
    return latest[DECISION_COLUMNS].sort_values("start_time").reset_index(drop=True)


def with_delivery_date(forecasts: pd.DataFrame) -> pd.DataFrame:
    """Add the UK delivery day of each target hour (no-op if already present)."""
    if "delivery_date" in forecasts:
        return forecasts
    return forecasts.assign(delivery_date=uk_date(forecasts["start_time"]))


def forecast_vintages(forecasts: pd.DataFrame, delivery_day: date) -> pd.DataFrame:
    """Every run published before delivery day D starts, restricted to D's target hours.

    These are all the forecasts a desk could have seen for D on or before D-1, whatever
    decision time it uses. Columns: ``publish_time, start_time, generation_mw``.
    """
    start, end = delivery_day_bounds(delivery_day)
    in_day = (forecasts["start_time"] >= start) & (forecasts["start_time"] < end)
    published_before = forecasts["publish_time"] < start
    return forecasts[in_day & published_before].sort_values(["publish_time", "start_time"]).reset_index(drop=True)


def with_actuals(frame: pd.DataFrame, actuals: pd.DataFrame) -> pd.DataFrame:
    """Attach the outturn of the settlement period that starts at each forecast's target time.

    WINDFOR is hourly and FUELHH half-hourly; as the brief specifies, the two are matched on
    ``start_time`` (alternatives such as hourly means change MAE by < 1%, see README).
    """
    outturn = actuals[["start_time", "generation_mw"]].rename(columns={"generation_mw": "actual_mw"})
    return frame.merge(outturn, on="start_time", how="left")
