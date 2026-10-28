import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyRow } from "../api/types";
import { TooltipCard } from "../components/TooltipCard";
import { calendarDate, gwTick, gwh, mw, pct, relativeChange } from "../lib/format";
import { SERIES } from "../lib/series";
import { CHART_MARGIN, barCursor, gridProps, hoveredRow, niceAxis, xAxisProps, yAxisProps } from "./chartKit";
import { RoundedBar } from "./RoundedBar";

/** Mean absolute error per delivery day, official vs error-adjusted; clicking a day opens it. */
export function DailyErrorChart({ rows, onSelectDay }: { rows: DailyRow[]; onSelectDay: (date: string) => void }) {
  const open = (index: number) => {
    const row = rows[index];
    if (row) onSelectDay(row.delivery_date);
  };
  const y = niceAxis(rows.flatMap((r) => [r.mae_official_mw, r.mae_adjusted_mw]));
  return (
    <div className="chart chart-clickable">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={rows} margin={CHART_MARGIN} barGap={2} barCategoryGap="22%" onClick={(state) => open(Number(state.activeIndex))}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} dataKey="delivery_date" tickFormatter={(d: string) => calendarDate(d, "short")} minTickGap={12} />
          <YAxis {...yAxisProps} domain={y.domain} ticks={y.ticks} tickFormatter={gwTick} />
          <Tooltip
            cursor={barCursor}
            content={(props) => {
              const row = hoveredRow<DailyRow>(props);
              if (!row) return null;
              return (
                <TooltipCard
                  title={calendarDate(row.delivery_date, "medium")}
                  rows={[
                    { label: `MAE, ${SERIES.official.short.toLowerCase()}`, value: mw(row.mae_official_mw), color: SERIES.official.color },
                    { label: `MAE, ${SERIES.adjusted.short.toLowerCase()}`, value: mw(row.mae_adjusted_mw), color: SERIES.adjusted.color },
                    {
                      label: "Forecast vs outturn energy",
                      value: `${gwh(row.forecast_mwh)} vs ${gwh(row.actual_mwh)} (${pct(relativeChange(row.forecast_mwh, row.actual_mwh), { signed: true })})`,
                    },
                  ]}
                  note="Click to open this delivery day"
                />
              );
            }}
          />
          <Bar dataKey="mae_official_mw" fill={SERIES.official.color} maxBarSize={14} shape={RoundedBar} activeBar={RoundedBar} isAnimationActive={false} />
          <Bar dataKey="mae_adjusted_mw" fill={SERIES.adjusted.color} maxBarSize={14} shape={RoundedBar} activeBar={RoundedBar} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
