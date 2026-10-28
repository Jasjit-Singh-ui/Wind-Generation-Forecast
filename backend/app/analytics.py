"""Use cases behind the API: compose forecast selection, calibration and metrics.

Everything here is a pure function of the loaded :class:`~app.repository.WindData` and the
request parameters, so results are cached per ``(decision_time, coverage)``.
"""

from __future__ import annotations

import math
from datetime import date, datetime, time, timedelta
from functools import lru_cache

import pandas as pd

from . import schemas, settings
from .calibration import Calibration, apply_calibration, calibrate
from .forecasting import decision_forecasts, forecast_vintages, with_actuals, with_delivery_date
from .metrics import (
    by_forecast_level,
    by_hour_of_day,
    daily_breakdown,
    error_histogram,
    error_quantiles,
    error_stats,
    interval_stats,
    lead_time_profile,
)
from .repository import WindData
from .timeutils import UK_TZ, date_range, decision_cutoff, delivery_day_bounds, format_hhmm

DEFAULT_COVERAGE = settings.SUPPORTED_COVERAGES[0]


class OutOfScopeError(ValueError):
    """The requested day is outside the pilot's delivery window."""


class Analytics:
    def __init__(self, data: WindData) -> None:
        self._data = data
        self._forecasts = with_delivery_date(data.forecasts)
        self.delivery_days = date_range(settings.FIRST_DELIVERY_DATE, settings.LAST_DELIVERY_DATE)
        # Decision-time forecasts are also needed for the calibration history before day 1.
        self._decision_days = date_range(settings.DATA_FIRST_DELIVERY_DATE, settings.LAST_DELIVERY_DATE)
        self._hourly = lru_cache(maxsize=128)(self._compute_hourly)
        self._horizon: schemas.Horizon | None = None

    # -- core -------------------------------------------------------------------------------

    def _compute_hourly(
        self, decision_time: time, coverage: int
    ) -> tuple[pd.DataFrame, dict[date, Calibration | None]]:
        """Decision-time forecast, error-adjusted forecast, interval and actual per target hour."""
        decisions = decision_forecasts(self._forecasts, self._decision_days, decision_time)
        decisions = with_actuals(decisions, self._data.actuals)
        calibrations = calibrate(decisions, self.delivery_days, coverage)
        return apply_calibration(decisions, calibrations), calibrations

    # -- /api/meta --------------------------------------------------------------------------

    def meta(self) -> schemas.Meta:
        actuals, forecasts = self._data.actuals, self._data.forecasts
        start, _ = delivery_day_bounds(settings.DATA_FIRST_DELIVERY_DATE)
        _, end = delivery_day_bounds(settings.LAST_DELIVERY_DATE)
        expected_periods = int((end - start) / timedelta(minutes=30))
        in_window = actuals[(actuals["start_time"] >= start) & (actuals["start_time"] < end)]

        runs = pd.Series(forecasts["publish_time"].unique())
        local_slot = runs.dt.tz_convert(UK_TZ).dt.strftime("%H:%M")
        days_with_runs = runs.dt.tz_convert(UK_TZ).dt.date.nunique()
        slot_counts = local_slot.value_counts()
        regular_slots = sorted(slot_counts[slot_counts > days_with_runs / 2].index)

        return schemas.Meta(
            window=schemas.Window(
                first_decision_date=settings.FIRST_DECISION_DATE,
                last_decision_date=settings.LAST_DECISION_DATE,
                first_delivery_date=settings.FIRST_DELIVERY_DATE,
                last_delivery_date=settings.LAST_DELIVERY_DATE,
            ),
            decision_presets=[
                schemas.DecisionPreset(id=p.id, label=p.label, time=format_hhmm(p.time), description=p.description)
                for p in settings.DECISION_PRESETS
            ],
            default_decision_time=format_hhmm(settings.DEFAULT_DECISION_TIME),
            calibration=schemas.CalibrationSettings(
                method="Empirical quantiles of actual/forecast ratios over a trailing window",
                lookback_days=settings.CALIBRATION_LOOKBACK_DAYS,
                min_forecast_mw=settings.CALIBRATION_MIN_FORECAST_MW,
                coverages=list(settings.SUPPORTED_COVERAGES),
                default_coverage=DEFAULT_COVERAGE,
            ),
            data=schemas.DataCoverage(
                source=self._data.source,
                fetched_at=self._data.fetched_at,
                actuals_from=_dt(actuals["start_time"].min()),
                actuals_to=_dt(actuals["start_time"].max()),
                actual_periods=len(in_window),
                missing_periods=expected_periods - len(in_window),
                forecast_runs=len(runs),
                forecast_rows=len(forecasts),
                runs_from=_dt(runs.min()),
                runs_to=_dt(runs.max()),
                publish_slots=regular_slots,
                off_schedule_runs=[_dt(r) for r in runs[~local_slot.isin(regular_slots)].sort_values()],
            ),
        )

    # -- /api/day-ahead ---------------------------------------------------------------------

    def day_ahead(self, day: date, decision_time: time, coverage: int = DEFAULT_COVERAGE) -> schemas.DayAhead:
        if day not in self.delivery_days:
            raise OutOfScopeError(
                f"{day} is outside the delivery window {settings.FIRST_DELIVERY_DATE}..{settings.LAST_DELIVERY_DATE}"
            )
        hourly, calibrations = self._hourly(decision_time, coverage)
        start, end = delivery_day_bounds(day)
        cutoff = decision_cutoff(day, decision_time)

        grid = pd.DataFrame({"start_time": pd.date_range(start, end, freq="1h", inclusive="left")})
        rows = grid.merge(hourly[hourly["delivery_date"] == day].drop(columns="actual_mw"), on="start_time", how="left")
        rows = with_actuals(rows, self._data.actuals)
        covered = rows.dropna(subset=["forecast_mw"])
        day_actuals = self._data.actuals[
            (self._data.actuals["start_time"] >= start) & (self._data.actuals["start_time"] < end)
        ]

        runs_used = sorted(covered["publish_time"].unique())
        latest_run = runs_used[-1] if runs_used else None
        vintages = [
            schemas.Vintage(
                publish_time=_dt(published),
                available_at_decision=published < cutoff,
                used_for_decision=published in runs_used,
                points=[
                    schemas.VintagePoint(start_time=_dt(p.start_time), forecast_mw=_num(p.generation_mw))
                    for p in run.itertuples()
                ],
            )
            for published, run in forecast_vintages(self._data.forecasts, day).groupby("publish_time")
        ]

        calibration = calibrations.get(day)
        index = self.delivery_days.index(day)
        return schemas.DayAhead(
            delivery_date=day,
            previous_date=self.delivery_days[index - 1] if index > 0 else None,
            next_date=self.delivery_days[index + 1] if index + 1 < len(self.delivery_days) else None,
            decision=schemas.Decision(
                decision_date=day - timedelta(days=1),
                decision_time=format_hhmm(decision_time),
                cutoff=_dt(cutoff),
                latest_run=_dt(latest_run),
                runs_used=[_dt(r) for r in runs_used],
                minutes_before_cutoff=_num((cutoff - latest_run).total_seconds() / 60) if latest_run else None,
                lead_hours_min=_num(covered["lead_hours"].min()),
                lead_hours_max=_num(covered["lead_hours"].max()),
                hours_covered=len(covered),
                hours_in_day=len(grid),
            ),
            calibration=_calibration(calibration, coverage),
            summary=schemas.DaySummary(
                forecast_mwh=_num(covered["forecast_mw"].sum(min_count=1)),
                adjusted_mwh=_num(covered["adjusted_mw"].sum(min_count=1)),
                low_mwh=_num(covered["low_mw"].sum(min_count=1)),
                high_mwh=_num(covered["high_mw"].sum(min_count=1)),
                actual_mwh=_num(day_actuals["generation_mw"].sum(min_count=1) * 0.5),
                peak=_extremum(covered, largest=True),
                trough=_extremum(covered, largest=False),
                official=_error_stats(error_stats(rows["forecast_mw"], rows["actual_mw"])),
                adjusted=_error_stats(error_stats(rows["adjusted_mw"], rows["actual_mw"])),
                interval=_interval_stats(interval_stats(rows["low_mw"], rows["high_mw"], rows["actual_mw"])),
            ),
            hours=[
                schemas.HourRow(
                    start_time=_dt(r.start_time),
                    forecast_mw=_num(r.forecast_mw),
                    adjusted_mw=_num(r.adjusted_mw),
                    low_mw=_num(r.low_mw),
                    high_mw=_num(r.high_mw),
                    actual_mw=_num(r.actual_mw),
                    publish_time=_dt(r.publish_time),
                    lead_hours=_num(r.lead_hours),
                )
                for r in rows.itertuples()
            ],
            actuals=[
                schemas.ActualPoint(start_time=_dt(a.start_time), actual_mw=_num(a.generation_mw))
                for a in day_actuals.itertuples()
            ],
            vintages=vintages,
        )

    # -- /api/accuracy ----------------------------------------------------------------------

    def accuracy(self, decision_time: time, coverage: int = DEFAULT_COVERAGE) -> schemas.Accuracy:
        hourly, _ = self._hourly(decision_time, coverage)
        hourly = hourly[hourly["delivery_date"].isin(self.delivery_days)]
        paired = hourly.dropna(subset=["actual_mw"])
        start, _ = delivery_day_bounds(self.delivery_days[0])
        _, end = delivery_day_bounds(self.delivery_days[-1])
        window_actuals = self._data.actuals[
            (self._data.actuals["start_time"] >= start) & (self._data.actuals["start_time"] < end)
        ]
        daily = daily_breakdown(hourly, window_actuals)
        histogram = error_histogram(
            {
                "official": paired["forecast_mw"] - paired["actual_mw"],
                "adjusted": paired["adjusted_mw"] - paired["actual_mw"],
            }
        )

        return schemas.Accuracy(
            decision_time=format_hhmm(decision_time),
            coverage=coverage,
            period=schemas.Period(
                first_delivery_date=self.delivery_days[0],
                last_delivery_date=self.delivery_days[-1],
                days=len(self.delivery_days),
                hours=len(paired),
                lead_hours_min=_num(hourly["lead_hours"].min()),
                lead_hours_max=_num(hourly["lead_hours"].max()),
            ),
            official=_error_stats(error_stats(paired["forecast_mw"], paired["actual_mw"])),
            adjusted=_error_stats(error_stats(paired["adjusted_mw"], paired["actual_mw"])),
            interval=_interval_stats(interval_stats(paired["low_mw"], paired["high_mw"], paired["actual_mw"])),
            quantiles_official={
                k: _num(v) for k, v in error_quantiles(paired["forecast_mw"], paired["actual_mw"]).items()
            },
            quantiles_adjusted={
                k: _num(v) for k, v in error_quantiles(paired["adjusted_mw"], paired["actual_mw"]).items()
            },
            energy=schemas.Energy(
                forecast_mwh=_num(hourly["forecast_mw"].sum(min_count=1)),
                adjusted_mwh=_num(hourly["adjusted_mw"].sum(min_count=1)),
                actual_mwh=_num(window_actuals["generation_mw"].sum(min_count=1) * 0.5),
            ),
            daily=[
                schemas.DailyRow(
                    delivery_date=d.delivery_date,
                    hours=d.hours,
                    forecast_mwh=_num(d.forecast_mwh),
                    adjusted_mwh=_num(d.adjusted_mwh),
                    actual_mwh=_num(d.actual_mwh),
                    mae_official_mw=_num(d.mae_official_mw),
                    bias_official_mw=_num(d.bias_official_mw),
                    mae_adjusted_mw=_num(d.mae_adjusted_mw),
                    bias_adjusted_mw=_num(d.bias_adjusted_mw),
                )
                for d in daily.itertuples()
            ],
            by_hour=[
                schemas.HourOfDayRow(
                    hour=int(h.hour),
                    n=int(h.n),
                    mae_official_mw=_num(h.mae_official_mw),
                    bias_official_mw=_num(h.bias_official_mw),
                    mae_adjusted_mw=_num(h.mae_adjusted_mw),
                    bias_adjusted_mw=_num(h.bias_adjusted_mw),
                )
                for h in by_hour_of_day(paired).itertuples()
            ],
            by_level=[
                schemas.LevelRow(
                    level_from_mw=lv.level_from_mw,
                    level_to_mw=_num(lv.level_to_mw),
                    n=int(lv.n),
                    mae_official_mw=_num(lv.mae_official_mw),
                    bias_official_mw=_num(lv.bias_official_mw),
                    mae_adjusted_mw=_num(lv.mae_adjusted_mw),
                    bias_adjusted_mw=_num(lv.bias_adjusted_mw),
                )
                for lv in by_forecast_level(paired).itertuples()
            ],
            histogram=[
                schemas.HistogramBin(
                    bin_from_mw=b.bin_from_mw, bin_to_mw=b.bin_to_mw, official=int(b.official), adjusted=int(b.adjusted)
                )
                for b in histogram.itertuples()
            ],
            series=[
                schemas.SeriesPoint(
                    start_time=_dt(r.start_time),
                    forecast_mw=_num(r.forecast_mw),
                    adjusted_mw=_num(r.adjusted_mw),
                    low_mw=_num(r.low_mw),
                    high_mw=_num(r.high_mw),
                    actual_mw=_num(r.actual_mw),
                )
                for r in hourly.itertuples()
            ],
        )

    # -- /api/horizon -----------------------------------------------------------------------

    def horizon(self) -> schemas.Horizon:
        """Accuracy vs lead time (all runs) and vs decision time on D-1. Independent of the request."""
        if self._horizon is None:
            self._horizon = schemas.Horizon(lead_time=self._lead_time(), decision_times=self._decision_times())
        return self._horizon

    def _lead_time(self) -> list[schemas.LeadTimeBin]:
        start, _ = delivery_day_bounds(self.delivery_days[0])
        _, end = delivery_day_bounds(self.delivery_days[-1])
        forecasts = self._data.forecasts
        in_window = forecasts[(forecasts["start_time"] >= start) & (forecasts["start_time"] < end)]
        profile = lead_time_profile(with_actuals(in_window, self._data.actuals))
        return [
            schemas.LeadTimeBin(
                lead_from_h=int(b.lead_from_h),
                lead_to_h=int(b.lead_to_h),
                n=int(b.n),
                mae_mw=_num(b.mae_mw),
                rmse_mw=_num(b.rmse_mw),
                bias_mw=_num(b.bias_mw),
            )
            for b in profile.itertuples()
        ]

    def _decision_times(self) -> list[schemas.DecisionTimePoint]:
        """Accuracy for every distinct decision time on D-1.

        The decision-time forecast only changes when a run is published, so the accuracy is
        a step function of the decision time: evaluating just after every publish slot (and
        at midnight) gives the whole curve exactly.
        """
        first, _ = delivery_day_bounds(settings.FIRST_DECISION_DATE)
        _, last = delivery_day_bounds(settings.LAST_DECISION_DATE)
        runs = pd.Series(self._data.forecasts["publish_time"].unique())
        runs = runs[(runs >= first) & (runs < last)].dt.tz_convert(UK_TZ)
        slots = sorted({time(0, 0)} | {t.time().replace(second=0, microsecond=0) for t in runs})

        points = []
        for slot in slots:
            after_slot = (datetime.combine(date.min, slot) + timedelta(minutes=1)).time() if slot != time(0) else slot
            if after_slot < slot:  # a run at 23:59 has no "after" on the same day
                continue
            hourly, _ = self._hourly(after_slot, DEFAULT_COVERAGE)
            paired = hourly[hourly["delivery_date"].isin(self.delivery_days)].dropna(subset=["actual_mw"])
            official = error_stats(paired["forecast_mw"], paired["actual_mw"])
            adjusted = error_stats(paired["adjusted_mw"], paired["actual_mw"])
            interval = interval_stats(paired["low_mw"], paired["high_mw"], paired["actual_mw"])
            points.append(
                schemas.DecisionTimePoint(
                    from_time=format_hhmm(slot),
                    n=int(official["n"]),
                    mae_official_mw=_num(official["mae_mw"]),
                    bias_official_mw=_num(official["bias_mw"]),
                    mae_adjusted_mw=_num(adjusted["mae_mw"]),
                    interval_coverage_pct=_num(interval["coverage_pct"]),
                )
            )
        return points


# -- conversion helpers ---------------------------------------------------------------------


def _num(value: object, digits: int = 1) -> float | None:
    """Round for the wire; NaN/inf/None become null."""
    if value is None:
        return None
    number = float(value)  # type: ignore[arg-type]
    if math.isnan(number) or math.isinf(number):
        return None
    return round(number, digits)


def _dt(value: object) -> datetime | None:
    if value is None or pd.isna(value):
        return None
    return pd.Timestamp(value).to_pydatetime()


def _error_stats(stats: dict) -> schemas.ErrorStats:
    return schemas.ErrorStats(
        n=int(stats["n"]),
        mae_mw=_num(stats["mae_mw"]),
        rmse_mw=_num(stats["rmse_mw"]),
        bias_mw=_num(stats["bias_mw"]),
        wape_pct=_num(stats["wape_pct"], 2),
        p90_abs_error_mw=_num(stats["p90_abs_error_mw"]),
        max_over_mw=_num(stats["max_over_mw"]),
        max_under_mw=_num(stats["max_under_mw"]),
        share_over_pct=_num(stats["share_over_pct"], 2),
        correlation=_num(stats["correlation"], 4),
    )


def _interval_stats(stats: dict) -> schemas.IntervalStats:
    return schemas.IntervalStats(
        n=int(stats["n"]),
        coverage_pct=_num(stats["coverage_pct"], 2),
        below_pct=_num(stats["below_pct"], 2),
        above_pct=_num(stats["above_pct"], 2),
        mean_width_mw=_num(stats["mean_width_mw"]),
    )


def _calibration(calibration: Calibration | None, coverage: int) -> schemas.CalibrationUsed | None:
    if calibration is None:
        return None
    return schemas.CalibrationUsed(
        window_start=calibration.window_start,
        window_end=calibration.window_end,
        samples=calibration.samples,
        coverage=coverage,
        ratio_low=round(calibration.ratio_low, 4),
        ratio_mid=round(calibration.ratio_mid, 4),
        ratio_high=round(calibration.ratio_high, 4),
    )


def _extremum(frame: pd.DataFrame, largest: bool) -> schemas.Extremum | None:
    if frame.empty:
        return None
    row = frame.loc[frame["forecast_mw"].idxmax() if largest else frame["forecast_mw"].idxmin()]
    return schemas.Extremum(start_time=_dt(row["start_time"]), forecast_mw=_num(row["forecast_mw"]))
