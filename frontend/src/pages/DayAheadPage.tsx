import { useEffect, useState } from "react";
import { endpoints } from "../api/client";
import type { DayAhead, Meta, Vintage } from "../api/types";
import { DayBars } from "../charts/DayBars";
import { VintageChart } from "../charts/VintageChart";
import { ChartCard } from "../components/ChartCard";
import { CoveragePicker, DateStepper, DecisionTimePicker } from "../components/Controls";
import type { Column } from "../components/DataTable";
import { DecisionStrip } from "../components/DecisionStrip";
import { EnergyScale } from "../components/EnergyScale";
import { Hero } from "../components/Hero";
import { HourTable } from "../components/HourTable";
import { StatCard } from "../components/StatCard";
import { ErrorState, Loading } from "../components/StateBox";
import { useApi } from "../hooks/useApi";
import {
  DASH,
  calendarDate,
  calendarParts,
  duration,
  fmt,
  gw,
  hoursLabel,
  mw,
  pct,
  relativeChange,
  ukDateKey,
  ukDay,
  ukDayTime,
  ukStamp,
  ukTime,
} from "../lib/format";
import { SERIES, VINTAGE_RAMP } from "../lib/series";

interface DayAheadPageProps {
  meta: Meta;
  date: string;
  decisionTime: string;
  coverage: number;
  onDateChange: (date: string) => void;
  onDecisionTimeChange: (time: string) => void;
  onCoverageChange: (coverage: number) => void;
}

export function DayAheadPage(props: DayAheadPageProps) {
  const { meta, date, decisionTime, coverage, onDateChange, onDecisionTimeChange } = props;
  const { data, error, stale, retry } = useApi<DayAhead>(endpoints.dayAhead(date, decisionTime, coverage));

  // Arrow keys step through delivery days (ignored while typing or navigating a chart).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof Element && event.target.closest("input, select, textarea, .recharts-wrapper")) return;
      if (event.key === "ArrowLeft" && data?.previous_date) onDateChange(data.previous_date);
      if (event.key === "ArrowRight" && data?.next_date) onDateChange(data.next_date);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, onDateChange]);

  const { weekday, date: longDate } = calendarParts(date);
  const current = data?.delivery_date === date ? data : undefined;

  return (
    <div className="page">
      <Hero
        eyebrow="Delivery day"
        title={
          <>
            {weekday}
            <span className="dim">,</span>
            <br />
            {longDate}
          </>
        }
        sub={current ? <DecisionSummary day={current} /> : "Loading the forecast that was available at the decision…"}
        aside={
          <>
            <DateStepper value={date} min={meta.window.first_delivery_date} max={meta.window.last_delivery_date} onChange={onDateChange} />
            <DecisionTimePicker presets={meta.decision_presets} value={decisionTime} onChange={onDecisionTimeChange} />
          </>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={retry} />
      ) : !data ? (
        <Loading label="Loading the day-ahead view" />
      ) : (
        <div className="page stale-frame" data-stale={stale}>
          <DayContent {...props} day={data} />
        </div>
      )}
    </div>
  );
}

function DecisionSummary({ day }: { day: DayAhead }) {
  const { decision } = day;
  if (!decision.latest_run) return <>No forecast had been published for this day by the decision time.</>;
  const sameDay = ukDateKey(decision.latest_run) === ukDateKey(decision.cutoff);
  return (
    <>
      Purchase decided{" "}
      <b>
        {ukDay(decision.cutoff)} at {decision.decision_time}
      </b>{" "}
      UK. The latest forecast then was the WINDFOR run published{" "}
      <b>{sameDay ? ukTime(decision.latest_run) : ukDayTime(decision.latest_run)}</b>
      {decision.minutes_before_cutoff != null && <>, {duration(decision.minutes_before_cutoff)} before the decision</>}.
    </>
  );
}

function DayContent({ meta, coverage, onCoverageChange, day }: DayAheadPageProps & { day: DayAhead }) {
  const [showActual, setShowActual] = useState(true);
  const { decision, summary, calibration } = day;
  const tail = (100 - coverage) / 2;
  const toGwh = (mwh: number | null) => (mwh == null ? null : mwh / 1000);
  const averageMw = summary.forecast_mwh != null && decision.hours_covered ? summary.forecast_mwh / decision.hours_covered : null;
  const cover = summary.adjusted_mwh != null && summary.low_mwh != null ? summary.adjusted_mwh - summary.low_mwh : null;

  return (
    <>
      <DecisionStrip
        items={[
          { label: "Decision cutoff", value: ukStamp(decision.cutoff) },
          { label: "Forecast run used", value: decision.latest_run ? ukStamp(decision.latest_run) : DASH },
          { label: "Lead time to delivery", value: `${hoursLabel(decision.lead_hours_min)} – ${hoursLabel(decision.lead_hours_max)}` },
          calibration
            ? {
                label: `Error calibration · ${calendarDate(calibration.window_start, "short")}–${calendarDate(calibration.window_end, "short")}`,
                value: (
                  <>
                    outturn ≈ <span className="t-adjusted">{calibration.ratio_mid.toFixed(2)}</span> × forecast
                  </>
                ),
              }
            : { label: "Error calibration", value: "not enough history" },
        ]}
      />

      {decision.hours_covered < decision.hours_in_day && (
        <p className="notice">
          <strong>
            Only {decision.hours_covered} of {decision.hours_in_day} hours
          </strong>{" "}
          had a forecast published before {decision.decision_time}: runs from two days ahead stop at 21:00. Totals cover those
          hours only.
        </p>
      )}

      <div className="stats">
        <StatCard
          variant="official"
          color={SERIES.official.color}
          label="Official forecast"
          value={fmt(toGwh(summary.forecast_mwh))}
          unit="GWh"
          sub={
            <>
              avg {gw(averageMw)}
              {summary.peak && (
                <>
                  {" "}
                  · peak {gw(summary.peak.forecast_mw)} at {ukTime(summary.peak.start_time)}
                </>
              )}
            </>
          }
        />
        <StatCard
          variant="basis"
          badge="Our basis"
          color={SERIES.adjusted.color}
          label="Error-adjusted expectation"
          value={fmt(toGwh(summary.adjusted_mwh))}
          unit="GWh"
          sub={`${pct(relativeChange(summary.adjusted_mwh, summary.forecast_mwh), { digits: 1, signed: true })} vs official, from the last ${meta.calibration.lookback_days} days' errors`}
        />
        <StatCard
          color={SERIES.adjusted.color}
          ring
          label={`Low-wind case (P${tail})`}
          value={fmt(toGwh(summary.low_mwh))}
          unit="GWh"
          sub={cover != null ? `${fmt(cover / 1000)} GWh of extra cover if wind disappoints` : DASH}
        />
        <StatCard
          variant="hindsight"
          badge="Hindsight"
          color={SERIES.actual.color}
          label="Outturn"
          value={fmt(toGwh(summary.actual_mwh))}
          unit="GWh"
          sub={
            <>
              Official {pct(relativeChange(summary.forecast_mwh, summary.actual_mwh), { signed: true })} · adjusted{" "}
              <span className="t-actual">{pct(relativeChange(summary.adjusted_mwh, summary.actual_mwh), { signed: true })}</span> vs
              outturn
            </>
          }
        />
      </div>

      <EnergyScale
        title="Where the day landed"
        caption="Daily energy on one scale · GWh"
        low={toGwh(summary.low_mwh)}
        lowLabel={`P${tail}`}
        adjusted={toGwh(summary.adjusted_mwh)}
        official={toGwh(summary.forecast_mwh)}
        actual={showActual ? toGwh(summary.actual_mwh) : null}
      />

      <div className="day-grid">
        <ChartCard
          title={`Hourly GW · forecast at ${decision.decision_time} vs outturn`}
          subtitle="Bars are the error-adjusted forecast inside its uncertainty range; the blue tick is the official WINDFOR value, the dot is metered outturn."
          actions={
            <>
              <CoveragePicker options={meta.calibration.coverages} value={coverage} onChange={onCoverageChange} />
              <button type="button" className="btn btn--hindsight" aria-pressed={showActual} onClick={() => setShowActual((v) => !v)}>
                {showActual ? "Hide outturn" : "Show outturn"}
              </button>
            </>
          }
          legend={[
            { label: "Error-adjusted", color: SERIES.adjusted.color, kind: "bar" },
            { label: `${coverage}% range (P${tail}–P${100 - tail})`, color: SERIES.adjusted.color, kind: "area" },
            { label: "Official (WINDFOR)", color: SERIES.official.color, kind: "line" },
            ...(showActual ? [{ label: "Outturn · hindsight", color: SERIES.actual.color, kind: "dot" as const }] : []),
          ]}
        >
          <DayBars day={day} coverage={coverage} showActual={showActual} />
        </ChartCard>
        <HourTable day={day} coverage={coverage} showActual={showActual} />
      </div>

      <ChartCard
        title="How the forecast for this day evolved"
        subtitle={`Every WINDFOR run published before delivery: ${day.vintages.filter((v) => v.available_at_decision).length} were available at your decision, ${day.vintages.filter((v) => !v.available_at_decision).length} came after it.`}
        legend={[
          { label: "Runs before your decision (older → newer)", color: `linear-gradient(90deg, ${VINTAGE_RAMP.join(", ")})`, kind: "ramp" },
          { label: decision.latest_run ? `Decision run (${ukStamp(decision.latest_run)})` : "Decision run", color: SERIES.official.color, kind: "line" },
          { label: "Runs after your decision", color: SERIES.muted.color, kind: "line" },
          { label: "Outturn (FUELHH)", color: SERIES.actual.color, kind: "line" },
        ]}
        table={{ columns: vintageColumns, rows: day.vintages, filename: `wind-forecast-runs-${day.delivery_date}.csv` }}
        footnote="Runs published two days ahead only reach 21:00 on the delivery day, so their lines stop early."
      >
        <VintageChart day={day} />
      </ChartCard>
    </>
  );
}

const vintageColumns: Column<Vintage>[] = [
  { label: "Run published (UK)", value: (v) => ukDayTime(v.publish_time) },
  { label: "Status", value: (v) => (v.used_for_decision ? "Used for decision" : v.available_at_decision ? "Before decision" : "After decision") },
  { label: "Hours covered", value: (v) => v.points.length, numeric: true },
  { label: "Energy forecast (GWh)", value: (v) => Math.round(v.points.reduce((sum, p) => sum + p.forecast_mw, 0) / 100) / 10, numeric: true },
  {
    label: "Peak (MW)",
    value: (v) => Math.max(...v.points.map((p) => p.forecast_mw)),
    format: (v) => mw(Math.max(...v.points.map((p) => p.forecast_mw))).replace(" MW", ""),
    numeric: true,
  },
];
