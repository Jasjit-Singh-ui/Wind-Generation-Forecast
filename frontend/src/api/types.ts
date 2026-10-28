// Mirrors backend/app/schemas.py. Timestamps are UTC ISO strings, power in MW, energy in MWh,
// error = forecast - actual (positive = wind under-delivered), percentages 0-100.

export interface ErrorStats {
  n: number;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
  wape_pct: number | null;
  p90_abs_error_mw: number | null;
  max_over_mw: number | null;
  max_under_mw: number | null;
  share_over_pct: number | null;
  correlation: number | null;
}

export interface IntervalStats {
  n: number;
  coverage_pct: number | null;
  below_pct: number | null;
  above_pct: number | null;
  mean_width_mw: number | null;
}

// --- /api/meta ---

export interface DecisionPreset {
  id: string;
  label: string;
  time: string;
  description: string;
}

export interface Meta {
  window: {
    first_decision_date: string;
    last_decision_date: string;
    first_delivery_date: string;
    last_delivery_date: string;
  };
  decision_presets: DecisionPreset[];
  default_decision_time: string;
  calibration: {
    method: string;
    lookback_days: number;
    min_forecast_mw: number;
    coverages: number[];
    default_coverage: number;
  };
  data: {
    source: string;
    fetched_at: string | null;
    actuals_from: string;
    actuals_to: string;
    actual_periods: number;
    missing_periods: number;
    forecast_runs: number;
    forecast_rows: number;
    runs_from: string;
    runs_to: string;
    publish_slots: string[];
    off_schedule_runs: string[];
  };
}

// --- /api/day-ahead ---

export interface HourRow {
  start_time: string;
  forecast_mw: number | null;
  adjusted_mw: number | null;
  low_mw: number | null;
  high_mw: number | null;
  actual_mw: number | null;
  publish_time: string | null;
  lead_hours: number | null;
}

export interface Vintage {
  publish_time: string;
  available_at_decision: boolean;
  used_for_decision: boolean;
  points: { start_time: string; forecast_mw: number }[];
}

export interface Extremum {
  start_time: string;
  forecast_mw: number;
}

export interface DayAhead {
  delivery_date: string;
  previous_date: string | null;
  next_date: string | null;
  decision: {
    decision_date: string;
    decision_time: string;
    cutoff: string;
    latest_run: string | null;
    runs_used: string[];
    minutes_before_cutoff: number | null;
    lead_hours_min: number | null;
    lead_hours_max: number | null;
    hours_covered: number;
    hours_in_day: number;
  };
  calibration: {
    window_start: string;
    window_end: string;
    samples: number;
    coverage: number;
    ratio_low: number;
    ratio_mid: number;
    ratio_high: number;
  } | null;
  summary: {
    forecast_mwh: number | null;
    adjusted_mwh: number | null;
    low_mwh: number | null;
    high_mwh: number | null;
    actual_mwh: number | null;
    peak: Extremum | null;
    trough: Extremum | null;
    official: ErrorStats;
    adjusted: ErrorStats;
    interval: IntervalStats;
  };
  hours: HourRow[];
  actuals: { start_time: string; actual_mw: number }[];
  vintages: Vintage[];
}

// --- /api/accuracy ---

export interface DailyRow {
  delivery_date: string;
  hours: number;
  forecast_mwh: number | null;
  adjusted_mwh: number | null;
  actual_mwh: number | null;
  mae_official_mw: number | null;
  bias_official_mw: number | null;
  mae_adjusted_mw: number | null;
  bias_adjusted_mw: number | null;
}

export interface GroupErrors {
  n: number;
  mae_official_mw: number | null;
  bias_official_mw: number | null;
  mae_adjusted_mw: number | null;
  bias_adjusted_mw: number | null;
}

export interface HourOfDayRow extends GroupErrors {
  hour: number;
}

export interface LevelRow extends GroupErrors {
  level_from_mw: number;
  level_to_mw: number | null;
}

export interface HistogramBin {
  bin_from_mw: number;
  bin_to_mw: number;
  official: number;
  adjusted: number;
}

export interface SeriesPoint {
  start_time: string;
  forecast_mw: number | null;
  adjusted_mw: number | null;
  low_mw: number | null;
  high_mw: number | null;
  actual_mw: number | null;
}

export interface Accuracy {
  decision_time: string;
  coverage: number;
  period: {
    first_delivery_date: string;
    last_delivery_date: string;
    days: number;
    hours: number;
    lead_hours_min: number | null;
    lead_hours_max: number | null;
  };
  official: ErrorStats;
  adjusted: ErrorStats;
  interval: IntervalStats;
  quantiles_official: Record<string, number>;
  quantiles_adjusted: Record<string, number>;
  energy: { forecast_mwh: number | null; adjusted_mwh: number | null; actual_mwh: number | null };
  daily: DailyRow[];
  by_hour: HourOfDayRow[];
  by_level: LevelRow[];
  histogram: HistogramBin[];
  series: SeriesPoint[];
}

// --- /api/horizon ---

export interface LeadTimeBin {
  lead_from_h: number;
  lead_to_h: number;
  n: number;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
}

export interface DecisionTimePoint {
  from_time: string;
  n: number;
  mae_official_mw: number | null;
  bias_official_mw: number | null;
  mae_adjusted_mw: number | null;
  interval_coverage_pct: number | null;
}

export interface Horizon {
  lead_time: LeadTimeBin[];
  decision_times: DecisionTimePoint[];
}
