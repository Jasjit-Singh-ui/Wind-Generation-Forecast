import { describe, expect, it } from "vitest";
import { niceScale, placeLabels } from "./scale";

describe("niceScale", () => {
  it("frames the values with round ticks", () => {
    expect(niceScale([119, 146, 148, 171])).toEqual({ min: 100, max: 180, ticks: [100, 120, 140, 160, 180] });
    expect(niceScale([8395, 8855, 9695]).ticks).toEqual([8000, 8500, 9000, 9500, 10000]);
  });

  it("copes with a single value", () => {
    const { min, max } = niceScale([50]);
    expect(min).toBeLessThan(50);
    expect(max).toBeGreaterThan(50);
  });
});

describe("placeLabels", () => {
  it("moves a label to the second row when it would overlap its neighbour", () => {
    const placed = placeLabels([
      { item: "a", at: 30, widthPct: 10 },
      { item: "b", at: 35, widthPct: 10 },
      { item: "c", at: 80, widthPct: 10 },
    ]);
    expect(placed.map((p) => [p.item, p.row])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 0],
    ]);
  });

  it("keeps labels inside the track", () => {
    const [placed] = placeLabels([{ item: "edge", at: 0, widthPct: 20 }]);
    expect(placed.left).toBe(10);
  });
});
