import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LevelRow } from "../api/types";
import { TooltipCard } from "../components/TooltipCard";
import { levelLabel } from "../lib/chartData";
import { gwTick, mw } from "../lib/format";
import { SERIES } from "../lib/series";
import { CHART_MARGIN, NARROW_CHART_PX, barCursor, gridProps, hoveredRow, niceAxis, xAxisProps, yAxisProps } from "./chartKit";
import { useElementWidth } from "../hooks/useElementWidth";
import { RoundedBar } from "./RoundedBar";

/** Bias (mean forecast - outturn) by the level of the official forecast. */
export function LevelChart({ rows }: { rows: LevelRow[] }) {
  const data = rows.map((row) => ({ ...row, label: levelLabel(row) }));
  const y = niceAxis(rows.flatMap((r) => [r.bias_official_mw, r.bias_adjusted_mw]));
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const narrow = width > 0 && width < NARROW_CHART_PX;
  return (
    <div className="chart" ref={ref}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={CHART_MARGIN} barGap={2} barCategoryGap="30%">
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} dataKey="label" interval={0} tickFormatter={(label: string) => (narrow ? label.replace(" GW", "") : label)} />
          <YAxis {...yAxisProps} domain={y.domain} ticks={y.ticks} tickFormatter={gwTick} />
          <ReferenceLine y={0} stroke="var(--text-2)" strokeWidth={1} />
          <Tooltip
            cursor={barCursor}
            content={(props) => {
              const row = hoveredRow<LevelRow & { label: string }>(props);
              if (!row) return null;
              return (
                <TooltipCard
                  title={`Official forecast ${row.label}`}
                  rows={[
                    { label: `bias, ${SERIES.official.short.toLowerCase()}`, value: mw(row.bias_official_mw, { signed: true }), color: SERIES.official.color },
                    { label: `bias, ${SERIES.adjusted.short.toLowerCase()}`, value: mw(row.bias_adjusted_mw, { signed: true }), color: SERIES.adjusted.color },
                    { label: "MAE, official", value: mw(row.mae_official_mw) },
                    { label: "MAE, error-adjusted", value: mw(row.mae_adjusted_mw) },
                  ]}
                  note={`${row.n} delivery hours`}
                />
              );
            }}
          />
          <Bar dataKey="bias_official_mw" fill={SERIES.official.color} maxBarSize={24} shape={RoundedBar} activeBar={RoundedBar} isAnimationActive={false} />
          <Bar dataKey="bias_adjusted_mw" fill={SERIES.adjusted.color} maxBarSize={24} shape={RoundedBar} activeBar={RoundedBar} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
