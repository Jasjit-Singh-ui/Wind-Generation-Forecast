import type { TooltipContentProps } from "recharts";

// Shared chart chrome: hairline solid grid, recessive axes, 2px lines, >= 8px active dots with
// a surface ring. Colours are CSS variables so light/dark themes swap in one place.

export const CHART_MARGIN = { top: 10, right: 14, bottom: 4, left: 2 };
export const xAxisProps = {
  tickLine: false,
  axisLine: { stroke: "var(--axis)" },
  tick: { fontSize: 12 },
  tickMargin: 8,
} as const;
export const yAxisProps = { tickLine: false, axisLine: false, tick: { fontSize: 12 }, width: 54 } as const;
export const gridProps = { stroke: "var(--grid)", vertical: false } as const;
export const lineCursor = { stroke: "var(--axis)", strokeWidth: 1 };
export const barCursor = { fill: "var(--surface-2)" };
export const activeDot = { r: 4, strokeWidth: 2, stroke: "var(--surface)" };

export const HOUR_MS = 3_600_000;

/** Evenly spaced time ticks from `start` (inclusive) to `end` (inclusive). */
export function timeTicks(start: number, end: number, stepHours: number): number[] {
  const ticks: number[] = [];
  for (let t = start; t <= end; t += stepHours * HOUR_MS) ticks.push(t);
  return ticks;
}

/** The data row under the tooltip, if any. */
export function hoveredRow<Row>(props: TooltipContentProps): Row | undefined {
  if (!props.active || !props.payload?.length) return undefined;
  return props.payload[0].payload as Row;
}

const NICE_STEPS_MW = [250, 500, 1000, 2000, 2500, 5000, 10000, 20000];

/**
 * A y-axis with round GW ticks that always includes zero: picks the smallest step from
 * NICE_STEPS_MW that covers the data in at most `maxTicks` ticks.
 */
export function niceAxis(values: Array<number | null | undefined>, maxTicks = 6): { domain: [number, number]; ticks: number[] } {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v));
  const low = Math.min(0, ...finite);
  const high = Math.max(0, ...finite);
  const step =
    NICE_STEPS_MW.find((s) => Math.ceil(high / s) - Math.floor(low / s) <= maxTicks - 1) ?? NICE_STEPS_MW[NICE_STEPS_MW.length - 1];
  const min = Math.floor(low / step) * step;
  const max = Math.max(Math.ceil(high / step) * step, min + step);
  const ticks: number[] = [];
  for (let tick = min; tick <= max; tick += step) ticks.push(tick);
  return { domain: [min, max], ticks };
}

/** Below this chart width, axes show fewer ticks so labels never collide. */
export const NARROW_CHART_PX = 560;
