import { describe, expect, it } from "vitest";
import type { DayAhead, DecisionTimePoint } from "../api/types";
import { dayBarRows, decisionTimeRows, levelLabel, vintageChart } from "./chartData";

const point = (from_time: string, mae: number): DecisionTimePoint => ({
  from_time,
  n: 744,
  mae_official_mw: mae,
  bias_official_mw: mae,
  mae_adjusted_mw: mae / 2,
  interval_coverage_pct: 80,
});

describe("decisionTimeRows", () => {
  const rows = decisionTimeRows([point("00:00", 3000), point("07:30", 2000), point("15:30", 1000)], 5);
  const at = (minute: number) => rows.find((row) => row.minute === minute)!;

  it("applies a run only to decisions taken strictly after it is published", () => {
    expect(at(0).official).toBe(3000);
    expect(at(450).official).toBe(3000); // exactly 07:30: that run is not available yet
    expect(at(455).official).toBe(2000);
    expect(at(1440).official).toBe(1000);
  });

  it("covers the whole day on the grid", () => {
    expect(rows[0].minute).toBe(0);
    expect(rows[rows.length - 1].minute).toBe(1440);
  });
});

const day = {
  decision: { latest_run: "2026-01-14T07:30:00Z" },
  hours: [
    { start_time: "2026-01-15T00:00:00Z", forecast_mw: 10, adjusted_mw: 9, low_mw: 7, high_mw: 11, actual_mw: 8, publish_time: null, lead_hours: 16.5 },
  ],
  actuals: [
    { start_time: "2026-01-15T00:00:00Z", actual_mw: 8 },
    { start_time: "2026-01-15T00:30:00Z", actual_mw: 9 },
  ],
  vintages: [
    { publish_time: "2026-01-13T22:30:00Z", available_at_decision: true, used_for_decision: false, points: [{ start_time: "2026-01-15T00:00:00Z", forecast_mw: 12 }] },
    { publish_time: "2026-01-14T07:30:00Z", available_at_decision: true, used_for_decision: true, points: [{ start_time: "2026-01-15T00:00:00Z", forecast_mw: 10 }] },
    { publish_time: "2026-01-14T11:30:00Z", available_at_decision: false, used_for_decision: false, points: [{ start_time: "2026-01-15T00:00:00Z", forecast_mw: 9 }] },
  ],
} as unknown as DayAhead;

describe("dayBarRows", () => {
  it("gives one row per delivery hour with the range as a [low, high] pair", () => {
    const rows = dayBarRows(day);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: "00:00", adjusted: 9, range: [7, 11], official: 10, actual: 8 });
  });
});

describe("vintageChart", () => {
  it("classifies runs relative to the decision", () => {
    const { runs, rows } = vintageChart(day);
    expect(runs.map((run) => run.status)).toEqual(["earlier", "decision", "later"]);
    expect(runs[1].color).toBe("var(--vintage-5)"); // newest available run = official blue
    expect(rows[0]).toMatchObject({ run0: 12, run1: 10, run2: 9, actual: 8 });
  });
});

describe("levelLabel", () => {
  it("labels forecast-level bins", () => {
    expect(levelLabel({ level_from_mw: 0, level_to_mw: 4000 })).toBe("< 4 GW");
    expect(levelLabel({ level_from_mw: 4000, level_to_mw: 8000 })).toBe("4–8 GW");
    expect(levelLabel({ level_from_mw: 16000, level_to_mw: null })).toBe("≥ 16 GW");
  });
});
