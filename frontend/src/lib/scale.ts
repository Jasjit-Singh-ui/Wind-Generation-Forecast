// Layout maths for the one-line energy scale ("where the day landed").

const NICE_FRACTIONS = [1, 2, 2.5, 5, 10];

/** Round step and domain covering `values` in roughly `targetTicks` intervals (not forced to zero). */
export function niceScale(values: number[], targetTicks = 4): { min: number; max: number; ticks: number[] } {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { min: 0, max: 1, ticks: [0, 1] };
  let low = Math.min(...finite);
  let high = Math.max(...finite);
  if (low === high) {
    low -= Math.abs(low) * 0.1 || 1;
    high += Math.abs(high) * 0.1 || 1;
  }
  const raw = (high - low) / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = (NICE_FRACTIONS.find((f) => f * magnitude >= raw) ?? 10) * magnitude;
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let tick = min; tick <= max + step / 2; tick += step) ticks.push(Number(tick.toFixed(10)));
  return { min, max, ticks };
}

export interface PlacedLabel<T> {
  item: T;
  /** Centre of the label, in % of the track (clamped so the label stays inside). */
  left: number;
  row: 0 | 1;
}

/**
 * Put labels above their markers on one of two rows so neighbours never overlap.
 * `widthPct` is each label's width as a percentage of the track.
 */
export function placeLabels<T>(items: { item: T; at: number; widthPct: number }[]): PlacedLabel<T>[] {
  const lastRight: [number, number] = [-Infinity, -Infinity];
  return [...items]
    .sort((a, b) => a.at - b.at)
    .map(({ item, at, widthPct }) => {
      const half = widthPct / 2;
      const left = Math.min(Math.max(at, half), 100 - half);
      const row: 0 | 1 = left - half >= lastRight[0] + 1 ? 0 : 1;
      lastRight[row] = left + half;
      return { item, left, row };
    });
}
