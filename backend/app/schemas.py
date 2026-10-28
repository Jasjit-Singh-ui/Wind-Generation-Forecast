"""API response contracts (mirrored by ``frontend/src/api/types.ts``).

Conventions: timestamps are UTC ISO-8601; power in MW, energy in MWh; ``error = forecast -
actual`` (positive = wind under-delivered); percentages are 0-100.
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class ErrorStats(BaseModel):
    n: int
    mae_mw: float | None
    rmse_mw: float | None
    bias_mw: float | None
    wape_pct: float | None
    p90_abs_error_mw: float | None
    max_over_mw: float | None
    max_under_mw: float | None
    share_over_pct: float | None
    correlation: float | None


class IntervalStats(BaseModel):
    n: int
    coverage_pct: float | None
    below_pct: float | None
    above_pct: float | None
    mean_width_mw: float | None


# --- /api/meta ---------------------------------------------------------------------------


class DecisionPreset(BaseModel):
    id: str
    label: str
    time: str
    description: str


class Window(BaseModel):
    first_decision_date: date
    last_decision_date: date
    first_delivery_date: date
    last_delivery_date: date


class CalibrationSettings(BaseModel):
    method: str
    lookback_days: int
    min_forecast_mw: float
    coverages: list[int]
    default_coverage: int


class DataCoverage(BaseModel):
    source: str
    fetched_at: datetime | None
    actuals_from: datetime
    actuals_to: datetime
    actual_periods: int
    missing_periods: int
    forecast_runs: int
    forecast_rows: int
    runs_from: datetime
    runs_to: datetime
    publish_slots: list[str]
    off_schedule_runs: list[datetime]


class Meta(BaseModel):
    window: Window
    decision_presets: list[DecisionPreset]
    default_decision_time: str
    calibration: CalibrationSettings
    data: DataCoverage


# --- /api/day-ahead ----------------------------------------------------------------------


class Decision(BaseModel):
    decision_date: date
    decision_time: str
    cutoff: datetime
    latest_run: datetime | None
    runs_used: list[datetime]
    minutes_before_cutoff: float | None
    lead_hours_min: float | None
    lead_hours_max: float | None
    hours_covered: int
    hours_in_day: int


class CalibrationUsed(BaseModel):
    window_start: date
    window_end: date
    samples: int
    coverage: int
    ratio_low: float
    ratio_mid: float
    ratio_high: float


class HourRow(BaseModel):
    start_time: datetime
    forecast_mw: float | None
    adjusted_mw: float | None
    low_mw: float | None
    high_mw: float | None
    actual_mw: float | None
    publish_time: datetime | None
    lead_hours: float | None


class ActualPoint(BaseModel):
    start_time: datetime
    actual_mw: float


class VintagePoint(BaseModel):
    start_time: datetime
    forecast_mw: float


class Vintage(BaseModel):
    publish_time: datetime
    available_at_decision: bool
    used_for_decision: bool
    points: list[VintagePoint]


class Extremum(BaseModel):
    start_time: datetime
    forecast_mw: float


class DaySummary(BaseModel):
    forecast_mwh: float | None
    adjusted_mwh: float | None
    low_mwh: float | None
    high_mwh: float | None
    actual_mwh: float | None
    peak: Extremum | None
    trough: Extremum | None
    official: ErrorStats
    adjusted: ErrorStats
    interval: IntervalStats


class DayAhead(BaseModel):
    delivery_date: date
    previous_date: date | None
    next_date: date | None
    decision: Decision
    calibration: CalibrationUsed | None
    summary: DaySummary
    hours: list[HourRow]
    actuals: list[ActualPoint]
    vintages: list[Vintage]


# --- /api/accuracy -----------------------------------------------------------------------


class Period(BaseModel):
    first_delivery_date: date
    last_delivery_date: date
    days: int
    hours: int
    lead_hours_min: float | None
    lead_hours_max: float | None


class Energy(BaseModel):
    forecast_mwh: float | None
    adjusted_mwh: float | None
    actual_mwh: float | None


class DailyRow(BaseModel):
    delivery_date: date
    hours: int
    forecast_mwh: float | None
    adjusted_mwh: float | None
    actual_mwh: float | None
    mae_official_mw: float | None
    bias_official_mw: float | None
    mae_adjusted_mw: float | None
    bias_adjusted_mw: float | None


class HourOfDayRow(BaseModel):
    hour: int
    n: int
    mae_official_mw: float | None
    bias_official_mw: float | None
    mae_adjusted_mw: float | None
    bias_adjusted_mw: float | None


class LevelRow(BaseModel):
    level_from_mw: float
    level_to_mw: float | None
    n: int
    mae_official_mw: float | None
    bias_official_mw: float | None
    mae_adjusted_mw: float | None
    bias_adjusted_mw: float | None


class HistogramBin(BaseModel):
    bin_from_mw: float
    bin_to_mw: float
    official: int
    adjusted: int


class SeriesPoint(BaseModel):
    start_time: datetime
    forecast_mw: float | None
    adjusted_mw: float | None
    low_mw: float | None
    high_mw: float | None
    actual_mw: float | None


class Accuracy(BaseModel):
    decision_time: str
    coverage: int
    period: Period
    official: ErrorStats
    adjusted: ErrorStats
    interval: IntervalStats
    quantiles_official: dict[str, float]
    quantiles_adjusted: dict[str, float]
    energy: Energy
    daily: list[DailyRow]
    by_hour: list[HourOfDayRow]
    by_level: list[LevelRow]
    histogram: list[HistogramBin]
    series: list[SeriesPoint]


# --- /api/horizon ------------------------------------------------------------------------


class LeadTimeBin(BaseModel):
    lead_from_h: int
    lead_to_h: int
    n: int
    mae_mw: float | None
    rmse_mw: float | None
    bias_mw: float | None


class DecisionTimePoint(BaseModel):
    from_time: str  # applies to decisions taken after this UK time, until the next point
    n: int
    mae_official_mw: float | None
    bias_official_mw: float | None
    mae_adjusted_mw: float | None
    interval_coverage_pct: float | None


class Horizon(BaseModel):
    lead_time: list[LeadTimeBin]
    decision_times: list[DecisionTimePoint]
