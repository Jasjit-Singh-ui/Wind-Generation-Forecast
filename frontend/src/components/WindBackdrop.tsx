import { useEffect, useRef, type CSSProperties } from "react";
import { FRAME_RATE, TRAIL, createField, drawField, stepField, type WindField } from "../lib/windField";

/**
 * Decorative background: a live wind-flow field across the viewport plus a cluster of turbines
 * in the hero. Purely visual (hidden from assistive tech); it pauses when the tab is hidden and
 * renders a still frame for people who prefer reduced motion.
 */
export function WindBackdrop() {
  return (
    <>
      <WindCanvas />
      <div className="turbines-layer" aria-hidden="true">
        <div className="shell turbines-shell">
          <Turbines />
        </div>
      </div>
    </>
  );
}

function WindCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let field: WindField;
    let frame = 0;
    let last = performance.now();
    let resizeTimer: number | undefined;

    const layout = () => {
      const { innerWidth: width, innerHeight: height } = window;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      field = createField(width, height);
      if (reducedMotion) {
        for (let step = 0; step < TRAIL; step++) stepField(field, step / FRAME_RATE, 1 / FRAME_RATE);
        drawField(ctx, field);
      }
    };

    const frameMs = 1000 / FRAME_RATE;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < frameMs - 1) return; // draw at FRAME_RATE, not the display's refresh rate
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      stepField(field, now / 1000, dt);
      drawField(ctx, field);
    };

    const start = () => {
      if (reducedMotion || document.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(layout, 150);
    };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      start();
    };

    layout();
    start();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="wind-canvas" aria-hidden="true" />;
}

const TURBINES = [
  { x: 70, tower: 95, blade: 40, spin: 7.5, opacity: 0.3 },
  { x: 185, tower: 130, blade: 54, spin: 11, opacity: 0.44 },
  { x: 320, tower: 170, blade: 70, spin: 9, opacity: 0.64 },
];
const GROUND = 250;

function Turbines() {
  return (
    <svg className="turbines" viewBox="0 0 420 260" role="presentation">
      <defs>
        <linearGradient id="turbine-tower" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d6e2f4" stopOpacity="0.95" />
          <stop offset="1" stopColor="#d6e2f4" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="turbine-haze" cx="0.64" cy="0.6" r="0.34">
          <stop offset="0" stopColor="#418ff7" stopOpacity="0.16" />
          <stop offset="1" stopColor="#418ff7" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="420" height="260" fill="url(#turbine-haze)" />
      {TURBINES.map(({ x, tower, blade, spin, opacity }) => {
        const hub = GROUND - tower;
        const bladePath = `M -2.4 0 C -3.6 ${-blade * 0.25}, -1.6 ${-blade * 0.75}, 0 ${-blade} C 1.3 ${-blade * 0.75}, 3.2 ${-blade * 0.3}, 2.4 0 Z`;
        return (
          <g key={x} opacity={opacity}>
            <path d={`M ${x - 2} ${hub} L ${x + 2} ${hub} L ${x + 4.2} ${GROUND} L ${x - 4.2} ${GROUND} Z`} fill="url(#turbine-tower)" />
            <rect x={x - 3.5} y={hub - 3.5} width={12} height={7} rx={3} fill="#d6e2f4" />
            <g className="turbine-rotor" style={{ transformOrigin: `${x}px ${hub}px`, animationDuration: `${spin}s` } as CSSProperties}>
              {[0, 120, 240].map((angle) => (
                <path key={angle} d={bladePath} transform={`translate(${x} ${hub}) rotate(${angle})`} fill="#d6e2f4" />
              ))}
            </g>
            <circle cx={x} cy={hub} r={3} fill="#eef2f8" />
          </g>
        );
      })}
    </svg>
  );
}
