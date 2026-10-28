import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LeadTimeBin } from "../api/types";
import { TooltipCard } from "../components/TooltipCard";
import { gwTick, mw } from "../lib/format";
import { SERIES } from "../lib/series";
import { CHART_MARGIN, NARROW_CHART_PX, activeDot, gridProps, hoveredRow, lineCursor, niceAxis, xAxisProps, yAxisProps } from "./chartKit";
import { useElementWidth } from "../hooks/useElementWidth";

type Row = LeadTimeBin & { mid: number };

/** Accuracy of every WINDFOR run by lead time, with the day-ahead decision window shaded. */
export function LeadTimeChart({ bins, window }: { bins: LeadTimeBin[]; window: [number, number] | null }) {
  const rows: Row[] = bins.map((bin) => ({ ...bin, mid: (bin.lead_from_h + bin.lead_to_h) / 2 }));
  const maxLead = rows.length ? rows[rows.length - 1].lead_to_h : 72;
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const step = width > 0 && width < NARROW_CHART_PX ? 12 : 6;
  const ticks = Array.from({ length: Math.floor(maxLead / step) + 1 }, (_, i) => i * step);
  const y = niceAxis(rows.flatMap((r) => [r.mae_mw, r.bias_mw]));
  return (
    <div className="chart" ref={ref}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={CHART_MARGIN}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} dataKey="mid" type="number" domain={[0, maxLead]} ticks={ticks} tickFormatter={(h: number) => `${h} h`} />
          <YAxis {...yAxisProps} domain={y.domain} ticks={y.ticks} tickFormatter={gwTick} />
          {window && (
            <ReferenceArea
              x1={window[0]}
              x2={window[1]}
              fill="var(--text)"
              fillOpacity={0.05}
              stroke="none"
              label={{ value: "Your day-ahead window", position: "insideTop", className: "ref-label" }}
            />
          )}
          <Tooltip
            cursor={lineCursor}
            content={(props) => {
              const row = hoveredRow<Row>(props);
              if (!row) return null;
              return (
                <TooltipCard
                  title={`Lead time ${row.lead_from_h}–${row.lead_to_h} h`}
                  rows={[
                    { label: "MAE", value: mw(row.mae_mw), color: SERIES.official.color },
                    { label: "bias", value: mw(row.bias_mw, { signed: true }), color: SERIES.muted.color },
                    { label: "RMSE", value: mw(row.rmse_mw) },
                  ]}
                  note={`${row.n.toLocaleString("en-GB")} forecast hours`}
                />
              );
            }}
          />
          <Line dataKey="mae_mw" stroke={SERIES.official.color} strokeWidth={2} dot={false} activeDot={activeDot} isAnimationActive={false} />
          <Line dataKey="bias_mw" stroke={SERIES.muted.color} strokeWidth={2} dot={false} activeDot={activeDot} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
