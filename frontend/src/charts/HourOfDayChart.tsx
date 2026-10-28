import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HourOfDayRow } from "../api/types";
import { TooltipCard } from "../components/TooltipCard";
import { gwTick, hhmm, mw } from "../lib/format";
import { SERIES } from "../lib/series";
import { CHART_MARGIN, NARROW_CHART_PX, activeDot, gridProps, hoveredRow, lineCursor, niceAxis, xAxisProps, yAxisProps } from "./chartKit";
import { useElementWidth } from "../hooks/useElementWidth";

/** Mean absolute error by UK hour of the delivery day. */
export function HourOfDayChart({ rows }: { rows: HourOfDayRow[] }) {
  const y = niceAxis(rows.flatMap((r) => [r.mae_official_mw, r.mae_adjusted_mw]));
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const narrow = width > 0 && width < NARROW_CHART_PX;
  return (
    <div className="chart" ref={ref}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={CHART_MARGIN}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} dataKey="hour" interval={narrow ? 5 : 2} tickFormatter={(h: number) => hhmm(h * 60)} />
          <YAxis {...yAxisProps} domain={y.domain} ticks={y.ticks} tickFormatter={gwTick} />
          <Tooltip
            cursor={lineCursor}
            content={(props) => {
              const row = hoveredRow<HourOfDayRow>(props);
              if (!row) return null;
              return (
                <TooltipCard
                  title={`${hhmm(row.hour * 60)}–${hhmm((row.hour + 1) * 60)} (UK)`}
                  rows={[
                    { label: `MAE, ${SERIES.official.short.toLowerCase()}`, value: mw(row.mae_official_mw), color: SERIES.official.color },
                    { label: `MAE, ${SERIES.adjusted.short.toLowerCase()}`, value: mw(row.mae_adjusted_mw), color: SERIES.adjusted.color },
                    { label: "bias, official", value: mw(row.bias_official_mw, { signed: true }) },
                  ]}
                  note={`${row.n} delivery hours`}
                />
              );
            }}
          />
          <Line dataKey="mae_official_mw" stroke={SERIES.official.color} strokeWidth={2} dot={false} activeDot={activeDot} isAnimationActive={false} />
          <Line dataKey="mae_adjusted_mw" stroke={SERIES.adjusted.color} strokeWidth={2} dot={false} activeDot={activeDot} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
