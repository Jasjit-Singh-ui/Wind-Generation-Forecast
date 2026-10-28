import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type BarShapeProps } from "recharts";
import type { DayAhead } from "../api/types";
import { TooltipCard, type TooltipRow } from "../components/TooltipCard";
import { dayBarRows, type DayBarRow } from "../lib/chartData";
import { DASH, gwTick, mw, ukDayTime } from "../lib/format";
import { SERIES } from "../lib/series";
import { CHART_MARGIN, NARROW_CHART_PX, barCursor, gridProps, hoveredRow, niceAxis, xAxisProps, yAxisProps } from "./chartKit";
import { useElementWidth } from "../hooks/useElementWidth";

// Each layer sits on its own hidden category axis so the four marks overlap in the same slot
// instead of being placed side by side.
const AXES = ["range", "adjusted", "official", "actual"] as const;
const GRADIENT_ID = "day-bars-adjusted";

function RangeShape({ x, y, width, height }: BarShapeProps) {
  if (!width || !height) return <g />;
  return (
    <rect
      x={x}
      y={Math.min(y, y + height)}
      width={width}
      height={Math.abs(height)}
      rx={3}
      fill={SERIES.adjusted.color}
      fillOpacity={0.22}
    />
  );
}

function AdjustedShape({ x, y, width, height }: BarShapeProps) {
  if (!width || !height) return <g />;
  const w = width * 0.56;
  const left = x + (width - w) / 2;
  const top = Math.min(y, y + height);
  const bottom = top + Math.abs(height);
  const r = Math.min(3, w / 2, bottom - top);
  return (
    <path
      d={`M${left},${bottom}V${top + r}A${r},${r} 0 0 1 ${left + r},${top}H${left + w - r}A${r},${r} 0 0 1 ${left + w},${top + r}V${bottom}Z`}
      fill={`url(#${GRADIENT_ID})`}
    />
  );
}

function OfficialTick({ x, y, width }: BarShapeProps) {
  if (!width) return <g />;
  return <rect x={x - 1} y={y - 1.5} width={width + 2} height={3} rx={1.5} fill={SERIES.official.color} />;
}

function OutturnDot({ x, y, width }: BarShapeProps) {
  if (!width) return <g />;
  return <circle cx={x + width / 2} cy={y} r={4.5} fill={SERIES.actual.color} stroke="var(--surface)" strokeWidth={2} />;
}

/** Hourly error-adjusted forecast inside its range, the official forecast as a tick, outturn as a dot. */
export function DayBars({ day, coverage, showActual }: { day: DayAhead; coverage: number; showActual: boolean }) {
  const rows = dayBarRows(day);
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const narrow = width > 0 && width < NARROW_CHART_PX;
  const y = niceAxis(rows.flatMap((r) => [r.range?.[1], r.official, r.adjusted, showActual ? r.actual : undefined]));

  return (
    <div className="chart" ref={ref}>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={rows} margin={CHART_MARGIN} barCategoryGap="16%">
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff9a5c" />
              <stop offset="100%" stopColor="#c4510f" />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} xAxisId="adjusted" dataKey="label" interval={narrow ? 5 : 2} />
          {AXES.filter((axis) => axis !== "adjusted").map((axis) => (
            <XAxis key={axis} xAxisId={axis} dataKey="label" hide />
          ))}
          <YAxis {...yAxisProps} domain={y.domain} ticks={y.ticks} tickFormatter={gwTick} />
          <Tooltip
            axisId="adjusted"
            cursor={barCursor}
            content={(props) => <DayBarsTooltip row={hoveredRow<DayBarRow>(props)} coverage={coverage} showActual={showActual} />}
          />
          <Bar xAxisId="range" dataKey="range" shape={RangeShape} isAnimationActive={false} />
          <Bar xAxisId="adjusted" dataKey="adjusted" shape={AdjustedShape} isAnimationActive={false} />
          <Bar xAxisId="official" dataKey="official" shape={OfficialTick} isAnimationActive={false} />
          {showActual && <Bar xAxisId="actual" dataKey="actual" shape={OutturnDot} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function DayBarsTooltip({ row, coverage, showActual }: { row: DayBarRow | undefined; coverage: number; showActual: boolean }) {
  if (!row) return null;
  const rows: TooltipRow[] = [
    { label: SERIES.adjusted.short, value: mw(row.adjusted), color: SERIES.adjusted.color, kind: "area" },
    {
      label: `${coverage}% range`,
      value: row.range ? `${mw(row.range[0]).replace(" MW", "")}${DASH}${mw(row.range[1])}` : DASH,
      color: SERIES.adjusted.color,
      kind: "area",
    },
    { label: SERIES.official.short, value: mw(row.official), color: SERIES.official.color },
  ];
  if (showActual) rows.push({ label: `${SERIES.actual.short} (hindsight)`, value: mw(row.actual), color: SERIES.actual.color, kind: "dot" });
  return <TooltipCard title={`${ukDayTime(row.t)} (UK)`} rows={rows} />;
}
