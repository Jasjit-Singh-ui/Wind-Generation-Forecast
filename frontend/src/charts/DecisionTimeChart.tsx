import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DecisionPreset, DecisionTimePoint } from "../api/types";
import { TooltipCard } from "../components/TooltipCard";
import { decisionTimeRows, type DecisionTimeRow } from "../lib/chartData";
import { gwTick, hhmm, minutesOfDay, mw, pct } from "../lib/format";
import { SERIES } from "../lib/series";
import { CHART_MARGIN, NARROW_CHART_PX, activeDot, gridProps, hoveredRow, lineCursor, niceAxis, xAxisProps, yAxisProps } from "./chartKit";
import { useElementWidth } from "../hooks/useElementWidth";

/**
 * Accuracy of the forecast available at each possible decision time on D-1. The forecast only
 * changes when a run is published, so the curves are step functions.
 */
export function DecisionTimeChart({
  points,
  presets,
  selected,
}: {
  points: DecisionTimePoint[];
  presets: DecisionPreset[];
  selected: string;
}) {
  const rows = decisionTimeRows(points);
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const tickMinutes = width > 0 && width < NARROW_CHART_PX ? 360 : 180;
  const selectedIsPreset = presets.some((preset) => preset.time === selected);
  const y = niceAxis(points.flatMap((p) => [p.mae_official_mw, p.mae_adjusted_mw]));
  return (
    <div className="chart" ref={ref}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={{ ...CHART_MARGIN, top: 22 }}>
          <CartesianGrid {...gridProps} />
          <XAxis
            {...xAxisProps}
            dataKey="minute"
            type="number"
            domain={[0, 1440]}
            ticks={Array.from({ length: 1440 / tickMinutes + 1 }, (_, i) => i * tickMinutes)}
            tickFormatter={(m: number) => hhmm(m)}
          />
          <YAxis {...yAxisProps} domain={y.domain} ticks={y.ticks} tickFormatter={gwTick} />
          {presets.map((preset, index) => (
            <ReferenceLine
              key={preset.id}
              x={minutesOfDay(preset.time)}
              stroke={preset.time === selected ? "var(--text)" : "var(--axis)"}
              strokeWidth={preset.time === selected ? 1.5 : 1}
              label={{
                value: preset.time,
                position: index === 0 ? "insideTopRight" : "insideTopLeft",
                className: "ref-label",
                offset: 4,
              }}
            />
          ))}
          {!selectedIsPreset && (
            <ReferenceLine
              x={minutesOfDay(selected)}
              stroke="var(--text)"
              strokeWidth={1.5}
              label={{ value: `${selected} (selected)`, position: "insideTopLeft", className: "ref-label", offset: 4 }}
            />
          )}
          <Tooltip
            cursor={lineCursor}
            content={(props) => {
              const row = hoveredRow<DecisionTimeRow>(props);
              if (!row) return null;
              const source =
                row.fromTime === "00:00"
                  ? "Uses runs from two days before delivery (cover delivery only until 21:00)"
                  : `Uses runs published up to ${row.fromTime}`;
              return (
                <TooltipCard
                  title={`Deciding at ${hhmm(row.minute)} on D−1`}
                  rows={[
                    { label: `MAE, ${SERIES.official.short.toLowerCase()}`, value: mw(row.official), color: SERIES.official.color },
                    { label: `MAE, ${SERIES.adjusted.short.toLowerCase()}`, value: mw(row.adjusted), color: SERIES.adjusted.color },
                    { label: "80% range hit rate", value: pct(row.coverage, { digits: 1 }) },
                  ]}
                  note={source}
                />
              );
            }}
          />
          <Line type="stepAfter" dataKey="official" stroke={SERIES.official.color} strokeWidth={2} dot={false} activeDot={activeDot} isAnimationActive={false} />
          <Line type="stepAfter" dataKey="adjusted" stroke={SERIES.adjusted.color} strokeWidth={2} dot={false} activeDot={activeDot} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
