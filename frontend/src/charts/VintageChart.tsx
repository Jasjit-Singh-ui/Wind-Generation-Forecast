import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayAhead } from "../api/types";
import { TooltipCard, type TooltipRow } from "../components/TooltipCard";
import { vintageChart, type VintageRow, type VintageRun } from "../lib/chartData";
import { DASH, gwTick, mw, ukDayTime, ukTime } from "../lib/format";
import { SERIES } from "../lib/series";
import { CHART_MARGIN, HOUR_MS, NARROW_CHART_PX, activeDot, gridProps, hoveredRow, lineCursor, niceAxis, timeTicks, xAxisProps, yAxisProps } from "./chartKit";
import { useElementWidth } from "../hooks/useElementWidth";

const DRAW_ORDER: Record<VintageRun["status"], number> = { later: 0, earlier: 1, decision: 2 };

export function VintageChart({ day }: { day: DayAhead }) {
  const { rows, runs } = vintageChart(day);
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const narrow = width > 0 && width < NARROW_CHART_PX;
  const start = Date.parse(day.hours[0].start_time);
  const end = start + day.decision.hours_in_day * HOUR_MS;
  const y = niceAxis(rows.flatMap((row) => [row.actual, ...runs.map((run) => row[run.key])]));
  // Paint context first so the decision run and the outturn stay on top.
  const drawn = [...runs].sort((a, b) => DRAW_ORDER[a.status] - DRAW_ORDER[b.status]);

  return (
    <div className="chart" ref={ref}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={rows} margin={CHART_MARGIN}>
          <CartesianGrid {...gridProps} />
          <XAxis
            {...xAxisProps}
            dataKey="t"
            type="number"
            scale="time"
            domain={[start, end]}
            ticks={timeTicks(start, end, narrow ? 6 : 3)}
            tickFormatter={(t: number) => ukTime(t)}
          />
          <YAxis {...yAxisProps} domain={y.domain} ticks={y.ticks} tickFormatter={gwTick} />
          <Tooltip cursor={lineCursor} content={(props) => <VintageTooltip row={hoveredRow<VintageRow>(props)} runs={runs} />} />
          {drawn.map((run) => (
            <Line
              key={run.key}
              dataKey={run.key}
              stroke={run.color}
              strokeWidth={2}
              strokeOpacity={run.status === "later" ? 0.55 : 1}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          <Line
            dataKey="actual"
            stroke={SERIES.actual.color}
            strokeWidth={2}
            dot={false}
            activeDot={activeDot}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function VintageTooltip({ row, runs }: { row: VintageRow | undefined; runs: VintageRun[] }) {
  if (!row) return null;
  const valued = runs.filter((run) => row[run.key] !== undefined);
  const decision = runs.find((run) => run.status === "decision");
  const items: TooltipRow[] = [];
  if (row.actual !== undefined) items.push({ label: SERIES.actual.short, value: mw(row.actual), color: SERIES.actual.color });
  if (decision && row[decision.key] !== undefined) {
    items.push({ label: `Decision run (${ukDayTime(decision.publishTime)})`, value: mw(row[decision.key]), color: decision.color });
  }
  if (valued.length > 0) {
    const first = valued[0];
    const last = valued[valued.length - 1];
    items.push({ label: `Earliest run (${ukDayTime(first.publishTime)})`, value: mw(row[first.key]), color: first.color });
    if (last !== decision) {
      items.push({ label: `Latest run (${ukDayTime(last.publishTime)})`, value: mw(row[last.key]), color: last.color });
    }
    const values = valued.map((run) => row[run.key] as number);
    items.push({ label: `Spread across ${valued.length} runs`, value: `${mw(Math.max(...values) - Math.min(...values))}` });
  }
  if (items.length === 0) items.push({ label: "No forecast for this half-hour", value: DASH });
  return <TooltipCard title={`${ukDayTime(row.t)} (UK)`} rows={items} />;
}
