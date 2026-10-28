import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TooltipCard } from "../components/TooltipCard";
import type { SeriesRow } from "../lib/chartData";
import { DASH, gwTick, mw, ukDateKey, ukDay, ukDayTime } from "../lib/format";
import { SERIES } from "../lib/series";
import { CHART_MARGIN, HOUR_MS, NARROW_CHART_PX, gridProps, hoveredRow, lineCursor, niceAxis, xAxisProps, yAxisProps } from "./chartKit";
import { useElementWidth } from "../hooks/useElementWidth";

/** All delivery hours of the backtest; clicking a point opens that delivery day. */
export function MonthChart({
  rows,
  coverage,
  onSelectDay,
}: {
  rows: SeriesRow[];
  coverage: number;
  onSelectDay: (date: string) => void;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  if (rows.length === 0) return null;
  const tickDays = width > 0 && width < NARROW_CHART_PX ? 7 : 2;
  const start = rows[0].t;
  const end = rows[rows.length - 1].t + HOUR_MS;
  const ticks: number[] = [];
  for (let t = start; t <= end; t += tickDays * 24 * HOUR_MS) ticks.push(t);
  const y = niceAxis(rows.flatMap((r) => [r.forecast, r.adjusted, r.band?.[1], r.actual]));

  return (
    <div className="chart chart-clickable" ref={ref}>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={rows}
          margin={CHART_MARGIN}
          onClick={(state) => {
            const row = rows[Number(state.activeIndex)];
            if (row) onSelectDay(ukDateKey(row.t));
          }}
        >
          <CartesianGrid {...gridProps} />
          <XAxis
            {...xAxisProps}
            dataKey="t"
            type="number"
            scale="time"
            domain={[start, end]}
            ticks={ticks}
            minTickGap={24}
            tickFormatter={(t: number) => ukDay(t).replace(/^\w+ /, "")}
          />
          <YAxis {...yAxisProps} domain={y.domain} ticks={y.ticks} tickFormatter={gwTick} />
          <Tooltip
            cursor={lineCursor}
            content={(props) => {
              const row = hoveredRow<SeriesRow>(props);
              if (!row) return null;
              return (
                <TooltipCard
                  title={`${ukDayTime(row.t)} (UK)`}
                  rows={[
                    { label: SERIES.official.short, value: mw(row.forecast), color: SERIES.official.color },
                    { label: SERIES.adjusted.short, value: mw(row.adjusted), color: SERIES.adjusted.color },
                    {
                      label: `${coverage}% range`,
                      value: row.band ? `${mw(row.band[0]).replace(" MW", "")}${DASH}${mw(row.band[1])}` : DASH,
                      color: SERIES.adjusted.color,
                      kind: "area",
                    },
                    { label: SERIES.actual.short, value: mw(row.actual), color: SERIES.actual.color },
                  ]}
                  note="Click to open this delivery day"
                />
              );
            }}
          />
          <Area dataKey="band" className="band" stroke="none" fill={SERIES.adjusted.color} fillOpacity={0.13} isAnimationActive={false} activeDot={false} />
          <Line dataKey="forecast" stroke={SERIES.official.color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line dataKey="adjusted" stroke={SERIES.adjusted.color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line dataKey="actual" stroke={SERIES.actual.color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
