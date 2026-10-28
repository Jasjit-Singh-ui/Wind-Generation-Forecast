export interface LegendItem {
  label: string;
  /** CSS colour; a gradient is allowed for `ramp` keys. */
  color: string;
  kind: "line" | "area" | "bar" | "ramp" | "dot";
}

/** HTML legend; the key mirrors the mark (a stroke for lines, a swatch for areas and bars). */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="legend" aria-label="Legend" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li key={item.label} className="legend-item">
          <span
            className={`legend-key ${item.kind}`}
            style={{ background: item.color, opacity: item.kind === "area" ? 0.35 : undefined }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
