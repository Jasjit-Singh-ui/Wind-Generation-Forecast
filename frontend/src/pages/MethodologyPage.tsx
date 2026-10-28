import type { Meta } from "../api/types";
import { DecisionStrip } from "../components/DecisionStrip";
import { Hero } from "../components/Hero";
import { DASH, calendarDate, ukDayTime } from "../lib/format";

export function MethodologyPage({ meta }: { meta: Meta }) {
  const { window: scope, calibration, data } = meta;
  const presets = meta.decision_presets;
  return (
    <div className="page">
      <Hero
        eyebrow="Methodology"
        title={
          <>
            How the numbers
            <br />
            are produced<span className="dim">.</span>
          </>
        }
        sub={
          <>
            Definitions, data and assumptions behind the day-ahead view and the accuracy backtest. Everything is computed from
            two Elexon BMRS datasets only: <b>wind outturn (FUELHH)</b> and the <b>national wind forecast (WINDFOR)</b>.
          </>
        }
      />

      <DecisionStrip
        items={[
          {
            label: "Decisions in scope",
            value: `${calendarDate(scope.first_decision_date, "short")} – ${calendarDate(scope.last_decision_date, "short")}`,
          },
          {
            label: "Delivery days",
            value: `${calendarDate(scope.first_delivery_date, "short")} – ${calendarDate(scope.last_delivery_date, "short")}`,
          },
          { label: "Forecast runs", value: `${data.forecast_runs} · ${data.publish_slots.length} per day` },
          { label: "Outturn periods", value: `${data.actual_periods.toLocaleString("en-GB")} · ${data.missing_periods} missing` },
        ]}
      />

      <div className="prose-grid">
        <section className="card prose">
          <h2>What the tool answers</h2>
          <ol>
            <li>
              <strong>What did the latest wind forecast say when we had to buy?</strong> For each delivery day, the forecast
              that was actually available at the day-ahead decision, hour by hour, with how it had evolved.
            </li>
            <li>
              <strong>How far can we trust it?</strong> The measured accuracy of that forecast, and an error-adjusted view
              with a range that turns the measured error into numbers a trader can act on.
            </li>
          </ol>
        </section>

        <section className="card prose">
          <h2>Scope: purchase decisions made in January 2026</h2>
          <p>
            A day-ahead purchase is made on the day before delivery. Decisions taken from{" "}
            <strong>{calendarDate(scope.first_decision_date, "long")}</strong> to{" "}
            <strong>{calendarDate(scope.last_decision_date, "long")}</strong> therefore buy power for delivery days{" "}
            <strong>
              {calendarDate(scope.first_delivery_date, "medium")} {DASH} {calendarDate(scope.last_delivery_date, "medium")}
            </strong>
            . Delivery days run 00:00{DASH}24:00 UK time (the settlement day).
          </p>
          <p>
            The error-adjusted forecast for a decision also needs the errors that were known at that moment, so the data
            includes a {calibration.lookback_days}-day history before the first delivery day.
          </p>
        </section>

        <section className="card prose">
          <h2>Which forecast was available at the decision</h2>
          <p>
            The decision time is a UK clock time on the day before delivery. The presets are the GB day-ahead auction gate
            closures:
          </p>
          <ul>
            {presets.map((preset) => (
              <li key={preset.id}>
                <strong>{preset.time}</strong> {DASH} {preset.description}
              </li>
            ))}
          </ul>
          <p>
            For every hour of the delivery day the tool takes the latest WINDFOR value published <strong>strictly before</strong>{" "}
            the decision time. Runs are picked per hour, so a late or missing run falls back to the previous one. In January
            2026 WINDFOR was published {data.publish_slots.length} times a day (UK time: {data.publish_slots.join(", ")}). Each
            run covers about three days, but runs published two days ahead stop at 21:00 on the delivery day.
          </p>
        </section>

        <section className="card prose">
          <h2>How accuracy is measured</h2>
          <div className="formula">{"error = forecast − outturn\n(positive = wind under-delivered: the desk is short)"}</div>
          <ul>
            <li>
              <strong>MAE</strong> (mean absolute error): the typical size of an hourly miss, in MW.
            </li>
            <li>
              <strong>Bias</strong> (mean error): the systematic part. Positive means the forecast runs high.
            </li>
            <li>
              <strong>RMSE</strong>: like MAE but penalises large misses more.
            </li>
            <li>
              <strong>WAPE</strong>: total absolute error as a share of total outturn. Unlike MAPE it does not blow up in
              low-wind hours.
            </li>
            <li>
              <strong>P90 absolute error</strong>: one hour in ten is off by more than this.
            </li>
          </ul>
          <p>
            WINDFOR is hourly and FUELHH half-hourly. Each hourly forecast is matched to the outturn of the settlement period
            starting at the same time, as the datasets&apos; <code>startTime</code> fields suggest. Comparing with the hourly
            mean, or a half-hour-centred mean, instead changes MAE by less than 1%. Daily energy totals use every half-hour of
            outturn.
          </p>
        </section>

        <section className="card prose">
          <h2>The error-adjusted forecast and range</h2>
          <p>
            Recent history says how the official forecast relates to what is metered. For each delivery day, the tool takes
            the decision-time forecasts and outturn of the previous {calibration.lookback_days} complete delivery days and
            computes the ratio <code>outturn / forecast</code> for every hour (ignoring hours forecast below{" "}
            {calibration.min_forecast_mw.toLocaleString("en-GB")} MW, where ratios are unstable).
          </p>
          <div className="formula">
            {"adjusted = forecast × median(ratio)\nrange    = forecast × [P10, P90] of ratio\n           (80% range; 90% uses P5–P95)"}
          </div>
          <p>
            <strong>No look-ahead:</strong> deciding on the day before delivery (D−1), the most recent complete outturn day is
            D−2, so the calibration window ends there. The backtest only ever uses information that was available at the
            decision. The range is checked by its hit rate: an 80% range should contain the outturn in about 80% of hours.
          </p>
          <p>
            A multiplicative model was chosen because the gap grows with the wind level, and because it explains simply, as
            a data-driven haircut. Additive and level-binned variants were also tested and were less accurate or less well
            calibrated.
          </p>
        </section>

        <section className="card prose">
          <h2>Why does the official forecast run high?</h2>
          <p>
            The gap is persistent (also present in December), shows up even a few hours ahead, and is larger at high wind and
            overnight. That points to a difference in <strong>what is measured</strong>, not weather-forecast skill. Two likely
            contributors, not separable with these two datasets alone:
          </p>
          <ul>
            <li>
              <strong>Coverage.</strong> WINDFOR covers wind farms visible to the system operator with operational metering;
              FUELHH counts transmission-metered generation only. Some generation in the forecast does not appear in the
              outturn.
            </li>
            <li>
              <strong>Curtailment.</strong> When the grid is constrained (typically windy, low-demand nights), wind farms are
              paid to reduce output. Metered outturn reflects that; a forecast of available wind does not.
            </li>
          </ul>
          <p>
            For a desk that settles against metered volumes, the practical answer is the same either way: calibrate the
            forecast to the outturn it will be judged against, which is what the error-adjusted view does.
          </p>
        </section>

        <section className="card prose">
          <h2>Data</h2>
          <ul>
            <li>
              <strong>Outturn:</strong> Elexon BMRS FUELHH stream, <code>fuelType = WIND</code>, half-hourly MW.{" "}
              {data.actual_periods.toLocaleString("en-GB")} settlement periods, {data.missing_periods} missing.
            </li>
            <li>
              <strong>Forecast:</strong> Elexon BMRS WINDFOR stream, hourly MW. {data.forecast_runs} runs published{" "}
              {ukDayTime(data.runs_from)} {DASH} {ukDayTime(data.runs_to)} ({data.forecast_rows.toLocaleString("en-GB")}{" "}
              values).
              {data.off_schedule_runs.length > 0 && (
                <> Off-schedule runs: {data.off_schedule_runs.map((run) => ukDayTime(run)).join(", ")}; handled like any other.</>
              )}
            </li>
            <li>
              <strong>Snapshot:</strong> {data.source === "snapshot" ? "bundled with the app" : "fetched live"}
              {data.fetched_at && <>, retrieved {ukDayTime(data.fetched_at)} UK</>}. A refresh script re-pulls it from the
              Elexon API.
            </li>
          </ul>
        </section>

        <section className="card prose">
          <h2>Limitations and next steps</h2>
          <ul>
            <li>One month of decisions is a small sample: the calibration should be monitored as seasons change.</li>
            <li>National wind only; demand, solar and the desk&apos;s own portfolio would turn this into a full residual view.</li>
            <li>
              Next: reconcile the coverage gap with the system operator&apos;s embedded-wind data, make the haircut
              level-dependent, and run the same view live each morning before gate closure.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
