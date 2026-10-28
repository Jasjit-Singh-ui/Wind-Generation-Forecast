"""Forecast accuracy metrics and breakdowns.

Sign convention used everywhere: ``error = forecast - actual``. A positive error means wind
came in *below* the forecast, i.e. a desk that relied on the forecast would be short and
have to buy the gap later (intraday or at imbalance prices).
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from .timeutils import uk_date, uk_hour

LEVEL_EDGES_MW = (0, 4_000, 8_000, 12_000, 16_000, math.inf)


def error_stats(forecast: pd.Series, actual: pd.Series) -> dict[str, float | int | None]:
    """Point-forecast accuracy over the hours where both values exist."""
    pair = pd.DataFrame({"forecast": forecast, "actual": actual}).dropna()
    error = pair["forecast"] - pair["actual"]
    if error.empty:
        return {"n": 0} | dict.fromkeys(
            (
                "mae_mw",
                "rmse_mw",
                "bias_mw",
                "wape_pct",
                "p90_abs_error_mw",
                "max_over_mw",
                "max_under_mw",
                "share_over_pct",
                "correlation",
            )
        )
    absolute = error.abs()
    total_actual = pair["actual"].abs().sum()
    return {
        "n": len(error),
        "mae_mw": absolute.mean(),
        "rmse_mw": math.sqrt((error**2).mean()),
        "bias_mw": error.mean(),
        # Weighted absolute percentage error: robust to near-zero hours, unlike MAPE.
        "wape_pct": 100 * absolute.sum() / total_actual if total_actual > 0 else None,
        "p90_abs_error_mw": absolute.quantile(0.9),
        "max_over_mw": error.max(),
        "max_under_mw": error.min(),
        "share_over_pct": 100 * (error > 0).mean(),
        "correlation": pair["forecast"].corr(pair["actual"]) if len(error) > 1 else None,
    }


def interval_stats(low: pd.Series, high: pd.Series, actual: pd.Series) -> dict[str, float | int | None]:
    """How often the outturn landed inside / below / above a prediction interval."""
    frame = pd.DataFrame({"low": low, "high": high, "actual": actual}).dropna()
    if frame.empty:
        return {"n": 0, "coverage_pct": None, "below_pct": None, "above_pct": None, "mean_width_mw": None}
    below = frame["actual"] < frame["low"]
    above = frame["actual"] > frame["high"]
    return {
        "n": len(frame),
        "coverage_pct": 100 * (~below & ~above).mean(),
        "below_pct": 100 * below.mean(),
        "above_pct": 100 * above.mean(),
        "mean_width_mw": (frame["high"] - frame["low"]).mean(),
    }


def error_quantiles(forecast: pd.Series, actual: pd.Series, levels=(0.05, 0.1, 0.5, 0.9, 0.95)) -> dict[str, float]:
    error = (forecast - actual).dropna()
    if error.empty:
        return {}
    return {f"p{round(q * 100)}": float(error.quantile(q)) for q in levels}


def daily_breakdown(hourly: pd.DataFrame, actuals: pd.DataFrame) -> pd.DataFrame:
    """Per delivery day: energy totals and point-forecast accuracy.

    Energies are in MWh: hourly forecasts count for one hour each, half-hourly outturn for
    half an hour, so the totals are directly comparable.
    """
    actual_energy = (
        actuals.assign(delivery_date=uk_date(actuals["start_time"]))
        .groupby("delivery_date")["generation_mw"]
        .sum()
        .mul(0.5)
        .rename("actual_mwh")
    )
    rows = []
    for day, group in hourly.groupby("delivery_date", sort=True):
        official = error_stats(group["forecast_mw"], group["actual_mw"])
        adjusted = error_stats(group["adjusted_mw"], group["actual_mw"])
        rows.append(
            {
                "delivery_date": day,
                "hours": len(group),
                "forecast_mwh": group["forecast_mw"].sum(),
                "adjusted_mwh": group["adjusted_mw"].sum(min_count=1),
                "mae_official_mw": official["mae_mw"],
                "bias_official_mw": official["bias_mw"],
                "mae_adjusted_mw": adjusted["mae_mw"],
                "bias_adjusted_mw": adjusted["bias_mw"],
            }
        )
    daily = pd.DataFrame(rows)
    if daily.empty:
        return daily
    return daily.merge(actual_energy, left_on="delivery_date", right_index=True, how="left")


def grouped_errors(hourly: pd.DataFrame, by: pd.Series) -> pd.DataFrame:
    """MAE and bias of the official and adjusted forecasts per group."""
    rows = []
    for key, group in hourly.groupby(by, sort=True, observed=True):
        official = error_stats(group["forecast_mw"], group["actual_mw"])
        adjusted = error_stats(group["adjusted_mw"], group["actual_mw"])
        rows.append(
            {
                "key": key,
                "n": official["n"],
                "mae_official_mw": official["mae_mw"],
                "bias_official_mw": official["bias_mw"],
                "mae_adjusted_mw": adjusted["mae_mw"],
                "bias_adjusted_mw": adjusted["bias_mw"],
            }
        )
    return pd.DataFrame(rows)


def by_hour_of_day(hourly: pd.DataFrame) -> pd.DataFrame:
    return grouped_errors(hourly, uk_hour(hourly["start_time"]).rename("hour")).rename(columns={"key": "hour"})


def by_forecast_level(hourly: pd.DataFrame, edges=LEVEL_EDGES_MW) -> pd.DataFrame:
    bins = pd.cut(hourly["forecast_mw"], bins=list(edges), right=False)
    table = grouped_errors(hourly, bins)
    if table.empty:
        return table
    table["level_from_mw"] = [interval.left for interval in table["key"]]
    table["level_to_mw"] = [None if math.isinf(interval.right) else interval.right for interval in table["key"]]
    return table.drop(columns="key")


def error_histogram(errors: dict[str, pd.Series], bin_width_mw: float = 500) -> pd.DataFrame:
    """Counts of hourly errors per bin, one column per named error series."""
    clean = {name: series.dropna() for name, series in errors.items()}
    values = pd.concat(clean.values()) if clean else pd.Series(dtype=float)
    if values.empty:
        return pd.DataFrame(columns=["bin_from_mw", "bin_to_mw", *clean])
    low = math.floor(values.min() / bin_width_mw) * bin_width_mw
    high = math.ceil(values.max() / bin_width_mw) * bin_width_mw + bin_width_mw
    edges = np.arange(low, high + bin_width_mw / 2, bin_width_mw)
    table = pd.DataFrame({"bin_from_mw": edges[:-1], "bin_to_mw": edges[1:]})
    for name, series in clean.items():
        table[name] = np.histogram(series, bins=edges)[0]
    return table


def lead_time_profile(paired: pd.DataFrame, bin_hours: int = 3) -> pd.DataFrame:
    """Accuracy of *all* forecast runs as a function of lead time (target - publish time).

    ``paired`` needs ``publish_time``, ``start_time``, ``generation_mw`` and ``actual_mw``.
    """
    frame = paired.dropna(subset=["actual_mw"])
    lead = (frame["start_time"] - frame["publish_time"]).dt.total_seconds() / 3600
    frame = frame.assign(lead=lead)[lead >= 0]
    frame = frame.assign(lead_from=(frame["lead"] // bin_hours * bin_hours).astype(int))
    rows = []
    for lead_from, group in frame.groupby("lead_from", sort=True):
        stats = error_stats(group["generation_mw"], group["actual_mw"])
        rows.append(
            {
                "lead_from_h": lead_from,
                "lead_to_h": lead_from + bin_hours,
                "n": stats["n"],
                "mae_mw": stats["mae_mw"],
                "rmse_mw": stats["rmse_mw"],
                "bias_mw": stats["bias_mw"],
            }
        )
    return pd.DataFrame(rows)
