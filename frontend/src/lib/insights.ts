// Headline numbers for the accuracy page, so chart titles state the finding, not just the topic.

import type { DailyRow, DecisionTimePoint, HourOfDayRow, LevelRow } from "../api/types";
import { minutesOfDay } from "./format";

function maxBy<T>(items: T[], score: (item: T) => number | null | undefined): T | undefined {
  let best: T | undefined;
  let bestScore = -Infinity;
  for (const item of items) {
    const value = score(item);
    if (value != null && value > bestScore) {
      best = item;
      bestScore = value;
    }
  }
  return best;
}

export const worstDay = (daily: DailyRow[]) => maxBy(daily, (d) => d.mae_official_mw);

export const peakHour = (rows: HourOfDayRow[]) => maxBy(rows, (r) => r.mae_official_mw);

/** The highest forecast-level bin that has data. */
export function topLevel(rows: LevelRow[]): LevelRow | undefined {
  return [...rows].reverse().find((row) => row.n > 0);
}

/** The step of the decision-time curve that applies to a decision taken at `hhmm`. */
export function stepAt(points: DecisionTimePoint[], hhmm: string): DecisionTimePoint | undefined {
  const minute = minutesOfDay(hhmm);
  let active: DecisionTimePoint | undefined;
  for (const point of [...points].sort((a, b) => minutesOfDay(a.from_time) - minutesOfDay(b.from_time))) {
    const from = minutesOfDay(point.from_time);
    if (from === 0 || from < minute) active = point;
  }
  return active;
}

/** The last step of the day: the freshest forecast obtainable on D-1. */
export function latestStep(points: DecisionTimePoint[]): DecisionTimePoint | undefined {
  return maxBy(points, (p) => minutesOfDay(p.from_time));
}

/** Percentage reduction from `before` to `after` (positive = improvement). */
export function reduction(before: number | null | undefined, after: number | null | undefined): number | null {
  if (before == null || after == null || before === 0) return null;
  return (100 * (before - after)) / before;
}
