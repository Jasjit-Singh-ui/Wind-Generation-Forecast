import { describe, expect, it } from "vitest";
import { addDays, calendarDate, duration, gw, gwTick, gwh, mw, pct, ukDateKey, ukHour, ukTime } from "./format";

describe("UK time formatting", () => {
  it("shows instants on the UK clock whatever the viewer's time zone", () => {
    expect(ukTime("2026-01-14T09:20:00Z")).toBe("09:20"); // GMT
    expect(ukTime("2026-07-14T08:20:00Z")).toBe("09:20"); // BST = UTC+1
    expect(ukHour("2026-07-14T23:30:00Z")).toBe(0);
    expect(ukDateKey("2026-07-14T23:30:00Z")).toBe("2026-07-15");
  });

  it("never shifts calendar dates", () => {
    expect(calendarDate("2026-01-02", "short")).toBe("2 Jan");
    expect(calendarDate("2026-01-02", "long")).toMatch(/^Friday,? 2 January 2026$/);
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });
});

describe("numbers", () => {
  it("formats power, energy and percentages with a typographic minus", () => {
    expect(mw(12345.6)).toBe("12,346 MW");
    expect(mw(-1500, { signed: true })).toBe("−1,500 MW");
    expect(mw(1500, { signed: true })).toBe("+1,500 MW");
    expect(gw(1745.9)).toBe("1.7 GW");
    expect(gwh(9_695_395)).toBe("9,695 GWh");
    expect(pct(-29.8, { signed: true })).toBe("−30%");
    expect(mw(null)).toBe("–");
  });

  it("keeps axis ticks compact", () => {
    expect(gwTick(0)).toBe("0");
    expect(gwTick(5000)).toBe("5 GW");
    expect(gwTick(12500)).toBe("12.5 GW");
  });

  it("formats durations", () => {
    expect(duration(110)).toBe("1 h 50 min");
    expect(duration(45)).toBe("45 min");
    expect(duration(120)).toBe("2 h");
  });
});
