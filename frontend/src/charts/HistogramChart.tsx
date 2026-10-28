import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistogramBin } from "../api/types";
import { TooltipCard } from "../components/TooltipCard";
import { gw, gwTick } from "../lib/format";
import { SERIES } from "../lib/series";
import { CHART_MARGIN, barCursor, gridProps, hoveredRow, xAxisProps, yAxisProps } from "./chartKit";
import { RoundedBar } from "./RoundedBar";

/** Distribution of hourly errors (forecast - outturn) for the official and error-adjusted forecasts. */
export function HistogramChart({ bins }: { bins: HistogramBin[] }) {
  const ticks = bins.filter((bin) => bin.bin_from_mw % 2000 === 0).map((bin) => bin.bin_from_mw);
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={bins} margin={CHART_MARGIN} barGap={2} barCategoryGap="18%">
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} dataKey="bin_from_mw" ticks={ticks} interval={0} tickFormatter={(v: number) => gwTick(v)} />
          <YAxis {...yAxisProps} allowDecimals={false} width={40} />
          <ReferenceLine x={0} position="start" stroke="var(--text-2)" strokeWidth={1} />
          <Tooltip
            cursor={barCursor}
            content={(props) => {
              const bin = hoveredRow<HistogramBin>(props);
              if (!bin) return null;
              const range = `${gw(bin.bin_from_mw, { signed: true })} to ${gw(bin.bin_to_mw, { signed: true })}`;
              return (
                <TooltipCard
                  title={`Error ${range}`}
                  rows={[
                    { label: `hours, ${SERIES.official.short.toLowerCase()}`, value: String(bin.official), color: SERIES.official.color },
                    { label: `hours, ${SERIES.adjusted.short.toLowerCase()}`, value: String(bin.adjusted), color: SERIES.adjusted.color },
                  ]}
                  note={bin.bin_from_mw >= 0 ? "Wind came in below the forecast" : "Wind came in above the forecast"}
                />
              );
            }}
          />
          <Bar dataKey="official" fill={SERIES.official.color} shape={RoundedBar} activeBar={RoundedBar} isAnimationActive={false} />
          <Bar dataKey="adjusted" fill={SERIES.adjusted.color} shape={RoundedBar} activeBar={RoundedBar} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <div className="legend" style={{ justifyContent: "space-between", paddingInline: "54px 14px", marginTop: 4 }} aria-hidden="true">
        <span>{`← wind above forecast`}</span>
        <span>{`wind below forecast (short) →`}</span>
      </div>
    </div>
  );
}
