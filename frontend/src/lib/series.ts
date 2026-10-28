// One colour per entity, used on every chart, legend, tooltip and table key.

export const SERIES = {
  official: { label: "Official forecast (WINDFOR)", short: "Official forecast", color: "var(--series-official)" },
  adjusted: { label: "Error-adjusted forecast", short: "Error-adjusted", color: "var(--series-adjusted)" },
  actual: { label: "Outturn (FUELHH)", short: "Outturn", color: "var(--series-actual)" },
  muted: { label: "", short: "", color: "var(--series-muted)" },
} as const;

export const bandLabel = (coverage: number) => `${coverage}% range (error-adjusted)`;

/** Ordinal blue ramp for forecast runs: index 0 = oldest, last = newest (official blue). */
export const VINTAGE_RAMP = ["var(--vintage-1)", "var(--vintage-2)", "var(--vintage-3)", "var(--vintage-4)", "var(--vintage-5)"];

/** Colour for the i-th of n runs available at the decision (oldest first). */
export function vintageColor(index: number, count: number): string {
  if (count <= 1) return VINTAGE_RAMP[VINTAGE_RAMP.length - 1];
  const step = Math.round((index / (count - 1)) * (VINTAGE_RAMP.length - 1));
  return VINTAGE_RAMP[step];
}
