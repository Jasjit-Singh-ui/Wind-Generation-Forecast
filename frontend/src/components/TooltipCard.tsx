import type { ReactNode } from "react";

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
  kind?: "line" | "area" | "dot";
}

/** Chart tooltip body: values lead, labels follow, keyed by a short stroke of the series colour. */
export function TooltipCard({ title, rows, note }: { title: string; rows: TooltipRow[]; note?: ReactNode }) {
  return (
    <div className="tooltip" role="status">
      <div className="tooltip-title">{title}</div>
      {rows.map((row) => (
        <div className="tooltip-row" key={row.label}>
          <span
            className={`tooltip-key ${row.kind ?? "line"}`}
            style={{ background: row.color ?? "transparent", opacity: row.kind === "area" ? 0.55 : 1 }}
            aria-hidden="true"
          />
          <span className="tooltip-value">{row.value}</span>
          <span className="tooltip-label">{row.label}</span>
        </div>
      ))}
      {note && <div className="tooltip-note">{note}</div>}
    </div>
  );
}
