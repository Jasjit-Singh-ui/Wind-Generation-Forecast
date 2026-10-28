import { describe, expect, it } from "vitest";
import { niceAxis, timeTicks } from "./chartKit";

describe("niceAxis", () => {
  it("picks round GW steps that include zero", () => {
    expect(niceAxis([16_889, 4_000])).toEqual({ domain: [0, 20_000], ticks: [0, 5_000, 10_000, 15_000, 20_000] });
    expect(niceAxis([2_600, 1_200]).ticks).toEqual([0, 1_000, 2_000, 3_000]);
  });

  it("extends below zero for signed data and ignores missing values", () => {
    expect(niceAxis([-280, 2_816, null, undefined]).ticks).toEqual([-1_000, 0, 1_000, 2_000, 3_000]);
  });

  it("still returns a usable axis without data", () => {
    expect(niceAxis([])).toEqual({ domain: [0, 250], ticks: [0, 250] });
  });
});

describe("timeTicks", () => {
  it("steps in whole hours from start to end", () => {
    const start = Date.parse("2026-01-15T00:00:00Z");
    expect(timeTicks(start, start + 6 * 3_600_000, 3)).toHaveLength(3);
  });
});
