import type { ReactNode } from "react";

/** One-line summary of the decision context: label above, monospaced value below. */
export function DecisionStrip({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="strip">
      {items.map((item, index) => (
        <div className="strip-item" key={index}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
