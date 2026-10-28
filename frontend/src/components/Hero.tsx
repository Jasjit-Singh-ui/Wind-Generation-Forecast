import type { ReactNode } from "react";

/** Page header: eyebrow, oversized title and summary on the left; the page's controls on the right. */
export function Hero({ eyebrow, title, sub, aside }: { eyebrow: string; title: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="hero">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="hero-title">{title}</h1>
        {sub && <p className="hero-sub">{sub}</p>}
      </div>
      {aside && <div className="hero-aside">{aside}</div>}
    </header>
  );
}
