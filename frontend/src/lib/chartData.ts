// Pure data shaping for the charts: API payloads in, chart-ready rows out (unit-tested).

import type { DayAhead, DecisionTimePoint, LevelRow, SeriesPoint } from "../api/types";
import { hhmm, ukTime } from "./format";
import { stepAt } from "./insights";
import { SERIES, vintageColor } from "./series";

export interface DayBarRow {
  t: number;
  label: string;
  adjusted?: number;
  range?: [number, number];
  official?: number;
  actual?: number;
}

/** One row per delivery hour for the hourly bar chart (outturn = the period starting on the hour). */
export function dayBarRows(day: DayAhead): DayBarRow[] {
  return day.hours.map((hour) => ({
    t: Date.parse(hour.start_time),
    label: ukTime(hour.start_time),
    adjusted: hour.adjusted_mw ?? undefined,
    range: hour.low_mw != null && hour.high_mw != null ? [hour.low_mw, hour.high_mw] : undefined,
    official: hour.forecast_mw ?? undefined,
    actual: hour.actual_mw ?? undefined,
  }));
}

// --- Forecast vintages (how the forecast for one delivery day evolved) ---

export type RunStatus = "earlier" | "decision" | "later";

export interface VintageRun {
  key: string;
  publishTime: string;
  status: RunStatus;
  color: string;
}

export interface VintageRow {
  t: number;
  actual?: number;
  [run: string]: number | undefined;
}

/**
 * One line per WINDFOR run published before delivery. Runs available at the decision get
 * the ordinal blue ramp (older = fainter, the decision run = official blue); runs published
 * after the cutoff are grey context.
 */
export function vintageChart(day: DayAhead): { rows: VintageRow[]; runs: VintageRun[] } {
  const available = day.vintages.filter((v) => v.available_at_decision);
  const runs: VintageRun[] = day.vintages.map((vintage, index) => {
    const status: RunStatus =
      vintage.publish_time === day.decision.latest_run ? "decision" : vintage.available_at_decision ? "earlier" : "later";
    const color = status === "later" ? SERIES.muted.color : vintageColor(available.indexOf(vintage), available.length);
    return { key: `run${index}`, publishTime: vintage.publish_time, status, color };
  });

  const rows = new Map<number, VintageRow>();
  const row = (t: number) => rows.get(t) ?? rows.set(t, { t }).get(t)!;
  day.vintages.forEach((vintage, index) => {
    for (const point of vintage.points) row(Date.parse(point.start_time))[`run${index}`] = point.forecast_mw;
  });
  for (const point of day.actuals) row(Date.parse(point.start_time)).actual = point.actual_mw;
  return { rows: [...rows.values()].sort((a, b) => a.t - b.t), runs };
}

// --- Month view ---

export interface SeriesRow {
  t: number;
  forecast?: number;
  adjusted?: number;
  band?: [number, number];
  actual?: number;
}

export function seriesRows(series: SeriesPoint[]): SeriesRow[] {
  return series.map((point) => ({
    t: Date.parse(point.start_time),
    forecast: point.forecast_mw ?? undefined,
    adjusted: point.adjusted_mw ?? undefined,
    band: point.low_mw != null && point.high_mw != null ? [point.low_mw, point.high_mw] : undefined,
    actual: point.actual_mw ?? undefined,
  }));
}

// --- Decision-time sensitivity ---

export interface DecisionTimeRow {
  minute: number;
  official: number | null;
  adjusted: number | null;
  coverage: number | null;
  n: number;
  fromTime: string;
}

/**
 * Expand the step points (each valid for decisions taken *after* its `from_time`) onto a
 * dense minute grid, so a tooltip anywhere on the curve reports the step it is on.
 */
export function decisionTimeRows(points: DecisionTimePoint[], stepMinutes = 5): DecisionTimeRow[] {
  const rows: DecisionTimeRow[] = [];
  for (let minute = 0; minute <= 24 * 60; minute += stepMinutes) {
    const active = stepAt(points, hhmm(Math.min(minute, 24 * 60 - 1)));
    if (!active) continue;
    rows.push({
      minute,
      official: active.mae_official_mw,
      adjusted: active.mae_adjusted_mw,
      coverage: active.interval_coverage_pct,
      n: active.n,
      fromTime: active.from_time,
    });
  }
  return rows;
}

// --- Labels ---

export function levelLabel(row: Pick<LevelRow, "level_from_mw" | "level_to_mw">): string {
  const from = row.level_from_mw / 1000;
  if (row.level_to_mw == null) return `≥ ${from} GW`;
  const to = row.level_to_mw / 1000;
  return from === 0 ? `< ${to} GW` : `${from}–${to} GW`;
}
