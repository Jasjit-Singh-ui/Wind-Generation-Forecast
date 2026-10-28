import type { CSSProperties } from "react";
import { useElementWidth } from "../hooks/useElementWidth";
import { placeLabels, niceScale } from "../lib/scale";
import { SERIES } from "../lib/series";

interface EnergyScaleProps {
  title: string;
  caption: string;
  /** Energies in GWh. */
  low: number | null;
  lowLabel: string;
  adjusted: number | null;
  official: number | null;
  actual?: number | null;
  format?: (gwh: number) => string;
}

type Mark = { key: string; label: string; value: number; color: string; text: string; shape: "ring" | "dot" | "tick" };

const CHAR_PX = 7.2; // ~ width of an 11.5px monospace glyph
const LABEL_PAD_PX = 12;

/**
 * The whole day (or period) on one energy axis: the low-wind case, our error-adjusted
 * expectation, the official forecast and, in hindsight, what was metered. The orange span is
 * the downside to cover (low -> expected); the striped blue span is the haircut applied to
 * the official forecast.
 */
export function EnergyScale({ title, caption, low, lowLabel, adjusted, official, actual, format = (v) => Math.round(v).toLocaleString("en-GB") }: EnergyScaleProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const marks: Mark[] = [];
  if (low != null) marks.push({ key: "low", label: lowLabel, value: low, color: SERIES.adjusted.color, text: "t-adjusted", shape: "ring" });
  if (adjusted != null) marks.push({ key: "adjusted", label: "Adjusted", value: adjusted, color: SERIES.adjusted.color, text: "t-adjusted", shape: "dot" });
  if (official != null) marks.push({ key: "official", label: "Official", value: official, color: SERIES.official.color, text: "t-official", shape: "dot" });
  if (actual != null) marks.push({ key: "actual", label: "Outturn", value: actual, color: SERIES.actual.color, text: "t-actual", shape: "tick" });
  if (marks.length === 0) return null;

  const { min, max, ticks } = niceScale(marks.map((m) => m.value));
  const at = (value: number) => ((value - min) / (max - min)) * 100;
  const pctWidth = (text: string) => (width > 0 ? ((text.length * CHAR_PX + LABEL_PAD_PX) / width) * 100 : 12);
  const text = (mark: Mark) => `${mark.label} ${format(mark.value)}`;

  const above = placeLabels(
    marks.filter((m) => m.shape !== "tick").map((mark) => ({ item: mark, at: at(mark.value), widthPct: pctWidth(text(mark)) })),
  );
  const below = placeLabels(
    marks.filter((m) => m.shape === "tick").map((mark) => ({ item: mark, at: at(mark.value), widthPct: pctWidth(text(mark)) })),
  );
  const span = (a: number | null, b: number | null) =>
    a == null || b == null ? null : { left: at(Math.min(a, b)), width: Math.abs(at(b) - at(a)) };
  const cover = span(low, adjusted);
  const haircut = span(adjusted, official);

  return (
    <section className="card" aria-label={title}>
      <div className="card-head">
        <div className="card-titles">
          <h2 className="card-title">{title}</h2>
        </div>
        <span className="caption">{caption}</span>
      </div>
      <div
        className="scale"
        ref={ref}
        role="img"
        aria-label={marks.map((mark) => `${mark.label} ${format(mark.value)}`).join(", ")}
      >
        <div className="scale-track" />
        {cover && <div className="scale-cover" style={{ left: `${cover.left}%`, width: `${cover.width}%` }} />}
        {haircut && <div className="scale-haircut" style={{ left: `${haircut.left}%`, width: `${haircut.width}%` }} />}
        {marks.map((mark) => (
          <span
            key={mark.key}
            className={`marker${mark.shape === "ring" ? " marker--ring" : mark.shape === "tick" ? " marker--tick" : ""}`}
            style={{ left: `${at(mark.value)}%`, "--c": mark.color } as CSSProperties}
          />
        ))}
        {above.map(({ item, left, row }) => (
          <span key={item.key} className={`mlabel mlabel--row${row} ${item.text}`} style={{ left: `${left}%` }}>
            {text(item)}
          </span>
        ))}
        {below.map(({ item, left }) => (
          <span key={item.key} className={`mlabel mlabel--below ${item.text}`} style={{ left: `${left}%` }}>
            {text(item)}
          </span>
        ))}
        <div className="scale-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ left: `${at(tick)}%` }}>
              {format(tick)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
