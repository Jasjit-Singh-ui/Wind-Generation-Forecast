import { describe, expect, it } from "vitest";
import { TRAIL, createField, flowAngle, flowSpeed, stepField } from "./windField";

// Deterministic pseudo-random numbers so the simulation is reproducible.
function seeded(seed = 7) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe("wind flow field", () => {
  it("blows broadly from west to east at a bounded speed", () => {
    for (const [x, y, t] of [
      [0, 0, 0],
      [400, 300, 12],
      [1440, 900, 300],
    ]) {
      expect(Math.cos(flowAngle(x, y, t))).toBeGreaterThan(0);
      expect(flowSpeed(x, y, t)).toBeGreaterThanOrEqual(0.65);
      expect(flowSpeed(x, y, t)).toBeLessThanOrEqual(1);
    }
  });

  it("scales the particle count with the viewport, within limits", () => {
    expect(createField(400, 800, seeded()).count).toBe(90);
    expect(createField(1440, 900, seeded()).count).toBe(249);
    expect(createField(3840, 2160, seeded()).count).toBe(420);
  });

  it("keeps particles inside (or just around) the canvas while animating", () => {
    const field = createField(800, 600, seeded());
    const rand = seeded(11);
    for (let frame = 0; frame < 300; frame++) stepField(field, frame / 30, 1 / 30, rand);
    for (let p = 0; p < field.count; p++) {
      const slot = p * TRAIL + field.head;
      expect(field.xs[slot]).toBeGreaterThanOrEqual(-40);
      expect(field.xs[slot]).toBeLessThanOrEqual(840);
      expect(field.ys[slot]).toBeGreaterThanOrEqual(-40);
      expect(field.ys[slot]).toBeLessThanOrEqual(640);
      expect(field.filled[p]).toBeGreaterThanOrEqual(1);
    }
  });
});
