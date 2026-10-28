import type { ReactNode } from "react";
import { endpoints } from "../api/client";
import type { Accuracy, DailyRow, DecisionTimePoint, HistogramBin, Horizon, HourOfDayRow, LeadTimeBin, LevelRow, Meta } from "../api/types";
import { DailyErrorChart } from "../charts/DailyErrorChart";
import { DecisionTimeChart } from "../charts/DecisionTimeChart";
import { HistogramChart } from "../charts/HistogramChart";
import { HourOfDayChart } from "../charts/HourOfDayChart";
import { LeadTimeChart } from "../charts/LeadTimeChart";
import { LevelChart } from "../charts/LevelChart";
import { MonthChart } from "../charts/MonthChart";
import { ChartCard } from "../components/ChartCard";
import { CoveragePicker, DecisionTimePicker } from "../components/Controls";
import type { Column } from "../components/DataTable";
import { DecisionStrip } from "../components/DecisionStrip";
import { EnergyScale } from "../components/EnergyScale";
import { Hero } from "../components/Hero";
import { StatCard } from "../components/StatCard";
import { ErrorState, Loading } from "../components/StateBox";
import { useApi } from "../hooks/useApi";
import { levelLabel, seriesRows } from "../lib/chartData";
import { DASH, calendarDate, fmt, fmtSigned, gw, gwh, hhmm, hoursLabel, mw, pct, relativeChange, ukDayTime } from "../lib/format";
import { latestStep, peakHour, reduction, stepAt, topLevel, worstDay } from "../lib/insights";
import { SERIES, bandLabel } from "../lib/series";

interface AccuracyPageProps {
  meta: Meta;
  decisionTime: string;
  coverage: number;
  onOpenDay: (date: string) => void;
  onDecisionTimeChange: (time: string) => void;
  onCoverageChange: (coverage: number) => void;
}

export function AccuracyPage(props: AccuracyPageProps) {
  const { meta, decisionTime, coverage, onDecisionTimeChange, onCoverageChange } = props;
  const accuracy = useApi<Accuracy>(endpoints.accuracy(decisionTime, coverage));
  const horizon = useApi<Horizon>(endpoints.horizon());
  const error = accuracy.error ?? horizon.error;
  const days = meta.window;

  return (
    <div className="page">
      <Hero
        eyebrow="Forecast accuracy · backtest"
        title={
          <>
            January 2026<span className="dim">,</span>
            <br />
            in hindsight
          </>
        }
        sub={
          <>
            Every purchase decided in January, at <b>{decisionTime}</b> on the day before delivery: hourly forecasts for{" "}
            <b>
              {calendarDate(days.first_delivery_date, "short")} – {calendarDate(days.last_delivery_date, "short")}
            </b>{" "}
            scored against metered outturn, using only what was known at each decision.
          </>
        }
        aside={
          <>
            <DecisionTimePicker presets={meta.decision_presets} value={decisionTime} onChange={onDecisionTimeChange} />
            <div className="control">
              <span className="control-label">Uncertainty range</span>
              <CoveragePicker options={meta.calibration.coverages} value={coverage} onChange={onCoverageChange} />
            </div>
          </>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={() => (accuracy.error ? accuracy.retry() : horizon.retry())} />
      ) : !accuracy.data || !horizon.data ? (
        <Loading label="Scoring the forecasts" />
      ) : (
        <div className="page stale-frame" data-stale={accuracy.stale}>
          <AccuracyContent {...props} a={accuracy.data} h={horizon.data} />
        </div>
      )}
    </div>
  );
}

function AccuracyContent({ meta, decisionTime, coverage, onOpenDay, a, h }: AccuracyPageProps & { a: Accuracy; h: Horizon }) {
  const official = a.official;
  const adjusted = a.adjusted;
  const tail = (100 - coverage) / 2;
  const maeCut = reduction(official.mae_mw, adjusted.mae_mw);
  const biasCut = reduction(official.bias_mw, adjusted.bias_mw);
  const energyGap = a.energy.forecast_mwh != null && a.energy.actual_mwh != null ? a.energy.forecast_mwh - a.energy.actual_mwh : null;
  const lowMwh = a.series.reduce((sum, point) => sum + (point.low_mw ?? 0), 0);
  const worst = worstDay(a.daily);
  const peak = peakHour(a.by_hour);
  const top = topLevel(a.by_level);
  const selectedStep = stepAt(h.decision_times, decisionTime);
  const freshest = latestStep(h.decision_times);
  const waitingGain = reduction(selectedStep?.mae_official_mw, freshest?.mae_official_mw);
  const leadWindow: [number, number] | null =
    a.period.lead_hours_min != null && a.period.lead_hours_max != null ? [a.period.lead_hours_min, a.period.lead_hours_max] : null;
  const firstLead = h.lead_time[0];
  const runsHigh = (official.bias_mw ?? 0) > 0;
  const overShare = official.share_over_pct ?? 0;
  const overnight = peak != null && (peak.hour < 7 || peak.hour >= 22);
  const biasGrowsWithWind = top != null && a.by_level.every((row) => (row.bias_official_mw ?? 0) <= (top.bias_official_mw ?? 0));
  const adjustingBeatsWaiting = waitingGain != null && maeCut != null && waitingGain < maeCut;

  return (
    <>
      <DecisionStrip
        items={[
          {
            label: "Delivery days scored",
            value: `${a.period.days} · ${calendarDate(a.period.first_delivery_date, "short")} – ${calendarDate(a.period.last_delivery_date, "short")}`,
          },
          { label: "Hourly forecasts", value: a.period.hours.toLocaleString("en-GB") },
          { label: "Lead time to delivery", value: `${hoursLabel(a.period.lead_hours_min)} – ${hoursLabel(a.period.lead_hours_max)}` },
          {
            label: `Calibration · trailing ${meta.calibration.lookback_days} days`,
            value: (
              <>
                ends <span className="t-adjusted">D−2</span>, no look-ahead
              </>
            ),
          },
        ]}
      />

      <div className="stats stats-3">
        <StatCard
          variant="official"
          color={SERIES.official.color}
          label="Average error, official"
          value={fmt(official.mae_mw)}
          unit="MW"
          sub={`MAE · ${pct(official.wape_pct, { digits: 1 })} of outturn · RMSE ${mw(official.rmse_mw)}`}
        />
        <StatCard
          color={SERIES.official.color}
          label="Bias, official"
          value={fmtSigned(official.bias_mw)}
          unit="MW"
          sub={`Over-forecast in ${pct(official.share_over_pct)} of hours`}
        />
        <StatCard
          variant="basis"
          badge="Our basis"
          color={SERIES.adjusted.color}
          label="Average error, error-adjusted"
          value={fmt(adjusted.mae_mw)}
          unit="MW"
          sub={
            <>
              <span className="t-actual">{pct(maeCut != null ? -maeCut : null, { signed: true })}</span> vs official · bias{" "}
              {mw(adjusted.bias_mw, { signed: true })}
            </>
          }
        />
        <StatCard
          color={SERIES.adjusted.color}
          ring
          label={`${coverage}% range hit rate (P${tail}–P${100 - tail})`}
          value={fmt(a.interval.coverage_pct, 1)}
          unit="%"
          sub={`Target ${coverage}% · ${pct(a.interval.below_pct)} below, ${pct(a.interval.above_pct)} above`}
        />
        <StatCard
          color={SERIES.actual.color}
          label="Metered wind energy"
          value={fmt((a.energy.actual_mwh ?? 0) / 1000)}
          unit="GWh"
          sub={`Official forecast ${gwh(a.energy.forecast_mwh)} (${pct(relativeChange(a.energy.forecast_mwh, a.energy.actual_mwh), { digits: 1, signed: true })})`}
        />
        <StatCard
          color={SERIES.official.color}
          label="1-in-10 hour error, official"
          value={fmt(official.p90_abs_error_mw)}
          unit="MW"
          sub="90th percentile of absolute hourly error"
        />
      </div>

      <EnergyScale
        title="Where the month landed"
        caption="Energy over all delivery days on one scale · GWh"
        low={lowMwh / 1000}
        lowLabel={`P${tail}`}
        adjusted={a.energy.adjusted_mwh == null ? null : a.energy.adjusted_mwh / 1000}
        official={a.energy.forecast_mwh == null ? null : a.energy.forecast_mwh / 1000}
        actual={a.energy.actual_mwh == null ? null : a.energy.actual_mwh / 1000}
      />

      <ol className="findings" aria-label="Key findings">
        <Finding index={1} title={runsHigh ? "The official forecast runs high" : "The official forecast runs low"}>
          It over-estimated wind in {pct(official.share_over_pct)} of hours, by {gw(official.bias_mw, { signed: true })} on
          average: {gwh(energyGap)} {(energyGap ?? 0) >= 0 ? "more" : "less"} wind than was metered.{" "}
          {runsHigh ? "Taken at face value it leaves the desk short." : "Taken at face value it leaves the desk long."}
        </Finding>
        <Finding index={2} title="Recent errors are a reliable correction">
          Scaling by the last {meta.calibration.lookback_days} days&apos; outturn/forecast ratio, using only data known at
          decision time, cuts the average error by {pct(maeCut)} and the bias by {pct(biasCut)}. Its {coverage}% range caught{" "}
          {pct(a.interval.coverage_pct)} of outcomes.
        </Finding>
        <Finding index={3} title={adjustingBeatsWaiting ? "Waiting helps less than adjusting" : "Later runs help"}>
          Deciding on the day&apos;s last run ({freshest?.from_time}) instead of {a.decision_time} would cut the average error by
          only {pct(waitingGain)}. The bias is present even 0{DASH}3 h ahead ({gw(firstLead?.bias_mw, { signed: true })}), so it
          is structural, not weather uncertainty.
        </Finding>
        {worst && (
          <Finding index={4} title="Misses cluster in time">
            The worst day was {calendarDate(worst.delivery_date, "weekday")}: forecast {gwh(worst.forecast_mwh)} against{" "}
            {gwh(worst.actual_mwh)} metered ({pct(relativeChange(worst.forecast_mwh, worst.actual_mwh), { signed: true })}).
            {peak && <> By hour, errors peak at {hhmm(peak.hour * 60)}.</>}
          </Finding>
        )}
      </ol>

      <ChartCard
        title="Decision-time forecast vs outturn, every delivery hour"
        subtitle={`Forecasts available at ${a.decision_time} on the day before each delivery day. Click any point to open that day.`}
        legend={[
          { label: SERIES.official.label, color: SERIES.official.color, kind: "line" },
          { label: SERIES.adjusted.label, color: SERIES.adjusted.color, kind: "line" },
          { label: bandLabel(coverage), color: SERIES.adjusted.color, kind: "area" },
          { label: SERIES.actual.label, color: SERIES.actual.color, kind: "line" },
        ]}
        table={{ columns: seriesColumns, rows: a.series, filename: `wind-accuracy-hourly-${a.decision_time.replace(":", "")}.csv` }}
      >
        <MonthChart rows={seriesRows(a.series)} coverage={coverage} onSelectDay={onOpenDay} />
      </ChartCard>

      <ChartCard
        title={worst ? `Daily error: worst on ${calendarDate(worst.delivery_date, "weekday")} (${gw(worst.mae_official_mw)} average)` : "Daily error"}
        subtitle="Mean absolute hourly error per delivery day. Click a day to see what the desk saw."
        legend={[
          { label: `${SERIES.official.short} (MAE)`, color: SERIES.official.color, kind: "bar" },
          { label: `${SERIES.adjusted.short} (MAE)`, color: SERIES.adjusted.color, kind: "bar" },
        ]}
        table={{ columns: dailyColumns, rows: a.daily, filename: `wind-accuracy-daily-${a.decision_time.replace(":", "")}.csv` }}
      >
        <DailyErrorChart rows={a.daily} onSelectDay={onOpenDay} />
      </ChartCard>

      <div className="grid-2">
        <ChartCard
          title={
            overShare >= 50
              ? `The official forecast is too high in ${pct(overShare)} of hours`
              : `The official forecast is too low in ${pct(100 - overShare)} of hours`
          }
          subtitle={`Hourly errors (forecast ${DASH} outturn) in 500 MW bins. Official P10/P50/P90: ${gw(a.quantiles_official.p10, { signed: true })} / ${gw(a.quantiles_official.p50, { signed: true })} / ${gw(a.quantiles_official.p90, { signed: true })}.`}
          legend={[
            { label: SERIES.official.short, color: SERIES.official.color, kind: "bar" },
            { label: SERIES.adjusted.short, color: SERIES.adjusted.color, kind: "bar" },
          ]}
          table={{ columns: histogramColumns, rows: a.histogram, filename: "wind-error-distribution.csv" }}
        >
          <HistogramChart bins={a.histogram} />
        </ChartCard>

        <ChartCard
          title={
            !peak
              ? "Error by hour of day"
              : overnight
                ? `Errors are largest overnight, peaking at ${hhmm(peak.hour * 60)}`
                : `Errors peak at ${hhmm(peak.hour * 60)}`
          }
          subtitle="Mean absolute error by UK hour of the delivery day."
          legend={[
            { label: SERIES.official.short, color: SERIES.official.color, kind: "line" },
            { label: SERIES.adjusted.short, color: SERIES.adjusted.color, kind: "line" },
          ]}
          table={{ columns: hourColumns, rows: a.by_hour, filename: "wind-error-by-hour.csv" }}
        >
          <HourOfDayChart rows={a.by_hour} />
        </ChartCard>

        <ChartCard
          title={
            top && biasGrowsWithWind
              ? `The over-forecast grows with the wind: ${gw(top.bias_official_mw, { signed: true })} when ${levelLabel(top)} is forecast`
              : "Bias by wind level"
          }
          subtitle="Mean error by the level of the official forecast. The adjustment removes most of it at every level."
          legend={[
            { label: `${SERIES.official.short} (bias)`, color: SERIES.official.color, kind: "bar" },
            { label: `${SERIES.adjusted.short} (bias)`, color: SERIES.adjusted.color, kind: "bar" },
          ]}
          table={{ columns: levelColumns, rows: a.by_level, filename: "wind-bias-by-level.csv" }}
        >
          <LevelChart rows={a.by_level} />
        </ChartCard>

        <ChartCard
          title={adjustingBeatsWaiting ? "Waiting for a later run helps less than adjusting" : "Accuracy by decision time"}
          subtitle="Average error of the forecast available at each decision time on the day before delivery. Lines mark the auction gate closures."
          legend={[
            { label: `${SERIES.official.short} (MAE)`, color: SERIES.official.color, kind: "line" },
            { label: `${SERIES.adjusted.short} (MAE)`, color: SERIES.adjusted.color, kind: "line" },
          ]}
          table={{ columns: decisionTimeColumns, rows: h.decision_times, filename: "wind-error-by-decision-time.csv" }}
        >
          <DecisionTimeChart points={h.decision_times} presets={meta.decision_presets} selected={decisionTime} />
        </ChartCard>
      </div>

      <ChartCard
        title={`Error grows slowly with lead time, but the bias is there even 0${DASH}3 h ahead`}
        subtitle="Every WINDFOR run scored against outturn for the same delivery days, by hours between publication and delivery."
        legend={[
          { label: "Average error (MAE)", color: SERIES.official.color, kind: "line" },
          { label: "Bias", color: SERIES.muted.color, kind: "line" },
          { label: "Lead times of your day-ahead decision", color: "var(--text)", kind: "area" },
        ]}
        table={{ columns: leadColumns, rows: h.lead_time, filename: "wind-error-by-lead-time.csv" }}
      >
        <LeadTimeChart bins={h.lead_time} window={leadWindow} />
      </ChartCard>
    </>
  );
}

function Finding({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <li className="finding">
      <span className="finding-index">{String(index).padStart(2, "0")}</span>
      <h3 className="finding-title">{title}</h3>
      <p>{children}</p>
    </li>
  );
}

const mwCell = (value: number | null) => mw(value).replace(" MW", "");
const signedCell = (value: number | null) => mw(value, { signed: true }).replace(" MW", "");

const seriesColumns: Column<Accuracy["series"][number]>[] = [
  { label: "Hour (UK)", value: (r) => r.start_time, format: (r) => ukDayTime(r.start_time) },
  { label: "Official (MW)", value: (r) => r.forecast_mw, format: (r) => mwCell(r.forecast_mw), numeric: true, color: SERIES.official.color },
  { label: "Adjusted (MW)", value: (r) => r.adjusted_mw, format: (r) => mwCell(r.adjusted_mw), numeric: true, color: SERIES.adjusted.color },
  { label: "Low (MW)", value: (r) => r.low_mw, format: (r) => mwCell(r.low_mw), numeric: true },
  { label: "High (MW)", value: (r) => r.high_mw, format: (r) => mwCell(r.high_mw), numeric: true },
  { label: "Outturn (MW)", value: (r) => r.actual_mw, format: (r) => mwCell(r.actual_mw), numeric: true, color: SERIES.actual.color },
];

const dailyColumns: Column<DailyRow>[] = [
  { label: "Delivery day", value: (r) => r.delivery_date, format: (r) => calendarDate(r.delivery_date, "weekday") },
  { label: "MAE official (MW)", value: (r) => r.mae_official_mw, format: (r) => mwCell(r.mae_official_mw), numeric: true, color: SERIES.official.color },
  { label: "MAE adjusted (MW)", value: (r) => r.mae_adjusted_mw, format: (r) => mwCell(r.mae_adjusted_mw), numeric: true, color: SERIES.adjusted.color },
  { label: "Bias official (MW)", value: (r) => r.bias_official_mw, format: (r) => signedCell(r.bias_official_mw), numeric: true },
  { label: "Forecast (MWh)", value: (r) => r.forecast_mwh, format: (r) => mwCell(r.forecast_mwh), numeric: true },
  { label: "Outturn (MWh)", value: (r) => r.actual_mwh, format: (r) => mwCell(r.actual_mwh), numeric: true },
];

const histogramColumns: Column<HistogramBin>[] = [
  { label: "Error from (MW)", value: (r) => r.bin_from_mw, format: (r) => signedCell(r.bin_from_mw), numeric: true },
  { label: "Error to (MW)", value: (r) => r.bin_to_mw, format: (r) => signedCell(r.bin_to_mw), numeric: true },
  { label: "Hours, official", value: (r) => r.official, numeric: true, color: SERIES.official.color },
  { label: "Hours, adjusted", value: (r) => r.adjusted, numeric: true, color: SERIES.adjusted.color },
];

const hourColumns: Column<HourOfDayRow>[] = [
  { label: "Hour (UK)", value: (r) => hhmm(r.hour * 60) },
  { label: "MAE official (MW)", value: (r) => r.mae_official_mw, format: (r) => mwCell(r.mae_official_mw), numeric: true, color: SERIES.official.color },
  { label: "MAE adjusted (MW)", value: (r) => r.mae_adjusted_mw, format: (r) => mwCell(r.mae_adjusted_mw), numeric: true, color: SERIES.adjusted.color },
  { label: "Bias official (MW)", value: (r) => r.bias_official_mw, format: (r) => signedCell(r.bias_official_mw), numeric: true },
  { label: "Hours", value: (r) => r.n, numeric: true },
];

const levelColumns: Column<LevelRow>[] = [
  { label: "Official forecast level", value: (r) => levelLabel(r) },
  { label: "Bias official (MW)", value: (r) => r.bias_official_mw, format: (r) => signedCell(r.bias_official_mw), numeric: true, color: SERIES.official.color },
  { label: "Bias adjusted (MW)", value: (r) => r.bias_adjusted_mw, format: (r) => signedCell(r.bias_adjusted_mw), numeric: true, color: SERIES.adjusted.color },
  { label: "MAE official (MW)", value: (r) => r.mae_official_mw, format: (r) => mwCell(r.mae_official_mw), numeric: true },
  { label: "MAE adjusted (MW)", value: (r) => r.mae_adjusted_mw, format: (r) => mwCell(r.mae_adjusted_mw), numeric: true },
  { label: "Hours", value: (r) => r.n, numeric: true },
];

const decisionTimeColumns: Column<DecisionTimePoint>[] = [
  { label: "Deciding after (UK)", value: (r) => r.from_time },
  { label: "MAE official (MW)", value: (r) => r.mae_official_mw, format: (r) => mwCell(r.mae_official_mw), numeric: true, color: SERIES.official.color },
  { label: "MAE adjusted (MW)", value: (r) => r.mae_adjusted_mw, format: (r) => mwCell(r.mae_adjusted_mw), numeric: true, color: SERIES.adjusted.color },
  { label: "Bias official (MW)", value: (r) => r.bias_official_mw, format: (r) => signedCell(r.bias_official_mw), numeric: true },
  { label: "80% range hit rate", value: (r) => r.interval_coverage_pct, format: (r) => pct(r.interval_coverage_pct, { digits: 1 }), numeric: true },
  { label: "Hours scored", value: (r) => r.n, numeric: true },
];

const leadColumns: Column<LeadTimeBin>[] = [
  { label: "Lead time", value: (r) => `${r.lead_from_h}-${r.lead_to_h} h`, format: (r) => `${r.lead_from_h}–${r.lead_to_h} h` },
  { label: "MAE (MW)", value: (r) => r.mae_mw, format: (r) => mwCell(r.mae_mw), numeric: true, color: SERIES.official.color },
  { label: "Bias (MW)", value: (r) => r.bias_mw, format: (r) => signedCell(r.bias_mw), numeric: true },
  { label: "RMSE (MW)", value: (r) => r.rmse_mw, format: (r) => mwCell(r.rmse_mw), numeric: true },
  { label: "Forecast hours", value: (r) => r.n, numeric: true },
];
