import type { CSSProperties, ReactNode } from "react";

export type StatVariant = "plain" | "official" | "basis" | "hindsight";

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
  variant?: StatVariant;
  /** Series colour of the bullet next to the label. */
  color?: string;
  /** Hollow bullet (used for range bounds such as P10). */
  ring?: boolean;
  badge?: string;
}

/** Headline number with its unit; the variant tints the card (our basis = orange, hindsight = hatched green). */
export function StatCard({ label, value, unit, sub, variant = "plain", color, ring, badge }: StatCardProps) {
  return (
    <div className={`stat stat--${variant}`}>
      <div className="stat-head">
        {color && (
          <span
            className={`bullet${ring ? " bullet--ring" : ""}`}
            style={{ "--c": color } as CSSProperties}
            aria-hidden="true"
          />
        )}
        <span>{label}</span>
        {badge && <span className={`badge badge--${variant === "hindsight" ? "hindsight" : "basis"}`}>{badge}</span>}
      </div>
      <div className="stat-value">
        <span className="stat-num">{value}</span>
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {sub && <p className="stat-sub">{sub}</p>}
    </div>
  );
}
