"""Turn the quantified forecast error into decision inputs.

The official forecast is converted into a central estimate and a prediction interval by
applying the empirical distribution of recent *actual / forecast* ratios:

    r        = actual / forecast   over the calibration window (decision-time forecasts)
    adjusted = forecast * median(r)
    low      = forecast * quantile(r, (1 - coverage) / 2)
    high     = forecast * quantile(r, (1 + coverage) / 2)

A multiplicative model fits the observed error structure (the gap grows with the wind
level) and is easy to explain as a data-driven "haircut". In a causal backtest on January
2026 it cut MAE by ~30% with well-calibrated intervals (see README, "Methodology").

No look-ahead: the calibration window for delivery day D is the ``lookback_days`` delivery
days ending on D-2. When the decision is taken on D-1, D-2 is the latest day whose outturn
is complete, so every number used was knowable at decision time.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import pandas as pd

from . import settings


@dataclass(frozen=True)
class Calibration:
    delivery_date: date
    window_start: date
    window_end: date
    samples: int
    ratio_low: float
    ratio_mid: float
    ratio_high: float


def calibration_window(delivery_day: date, lookback_days: int) -> tuple[date, date]:
    """Inclusive delivery-day range whose errors are fully known at D's decision."""
    return delivery_day - timedelta(days=lookback_days + 1), delivery_day - timedelta(days=2)


def quantile_levels(coverage: int) -> tuple[float, float, float]:
    """``(low, mid, high)`` quantiles of a central interval of ``coverage`` percent."""
    if not 0 < coverage < 100:
        raise ValueError(f"coverage must be a percentage between 0 and 100, got {coverage}")
    tail = (1 - coverage / 100) / 2
    return tail, 0.5, 1 - tail


def calibrate(
    decisions: pd.DataFrame,
    delivery_days: Iterable[date],
    coverage: int,
    lookback_days: int = settings.CALIBRATION_LOOKBACK_DAYS,
    min_forecast_mw: float = settings.CALIBRATION_MIN_FORECAST_MW,
    min_samples: int = settings.CALIBRATION_MIN_SAMPLES,
) -> dict[date, Calibration | None]:
    """Fit the ratio quantiles for each delivery day from its own trailing window.

    ``decisions`` must hold decision-time forecasts *with actuals* (``actual_mw``) for the
    calibration history as well as the target days. Days without enough history map to None.
    """
    usable = decisions.dropna(subset=["actual_mw"])
    usable = usable[usable["forecast_mw"] >= min_forecast_mw]
    ratios = (usable["actual_mw"] / usable["forecast_mw"]).to_numpy()
    day_numbers = np.array([d.toordinal() for d in usable["delivery_date"]], dtype=np.int64)
    levels = quantile_levels(coverage)

    fitted: dict[date, Calibration | None] = {}
    for day in delivery_days:
        first, last = calibration_window(day, lookback_days)
        window = ratios[(day_numbers >= first.toordinal()) & (day_numbers <= last.toordinal())]
        if len(window) < min_samples:
            fitted[day] = None
            continue
        low, mid, high = (float(q) for q in np.quantile(window, levels))
        fitted[day] = Calibration(day, first, last, len(window), low, mid, high)
    return fitted


def apply_calibration(decisions: pd.DataFrame, calibrations: dict[date, Calibration | None]) -> pd.DataFrame:
    """Add ``adjusted_mw``, ``low_mw`` and ``high_mw`` for the days that have a calibration."""
    factors = pd.DataFrame(
        [
            {"delivery_date": c.delivery_date, "r_low": c.ratio_low, "r_mid": c.ratio_mid, "r_high": c.ratio_high}
            for c in calibrations.values()
            if c is not None
        ],
        columns=["delivery_date", "r_low", "r_mid", "r_high"],
    )
    out = decisions[decisions["delivery_date"].isin(list(calibrations))].merge(factors, on="delivery_date", how="left")
    out["adjusted_mw"] = out["forecast_mw"] * out["r_mid"]
    out["low_mw"] = out["forecast_mw"] * out["r_low"]
    out["high_mw"] = out["forecast_mw"] * out["r_high"]
    return out.drop(columns=["r_low", "r_mid", "r_high"])
