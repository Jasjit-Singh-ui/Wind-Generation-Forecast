import { useId } from "react";
import type { DayAhead, HourRow } from "../api/types";
import type { Column } from "./DataTable";
import { downloadCsv, toCsv } from "../lib/csv";
import { DASH, ukDateKey, ukTime } from "../lib/format";

const gw1 = (mw: number | null) => (mw == null ? DASH : (mw / 1000).toFixed(1));

function delta(row: HourRow): number | null {
  return row.actual_mw != null && row.adjusted_mw != null ? row.actual_mw - row.adjusted_mw : null;
}

/** Outturn minus adjusted in GW with one decimal; differences that round to zero read as a neutral 0.0. */
function deltaText(diff: number | null): string {
  if (diff == null) return DASH;
  const rounded = Math.round(diff / 100) / 10;
  if (rounded === 0) return "0.0";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(1)}`;
}

function deltaClass(diff: number | null): string | undefined {
  if (diff == null || Math.round(diff / 100) === 0) return undefined;
  return diff > 0 ? "t-actual" : "t-negative";
}

/** Full-precision export of the same rows. */
function csvColumns(coverage: number): Column<HourRow>[] {
  const tail = (100 - coverage) / 2;
  return [
    { label: "Hour (UK)", value: (r) => `${ukDateKey(r.start_time)} ${ukTime(r.start_time)}` },
    { label: "Official forecast (MW)", value: (r) => r.forecast_mw },
    { label: "Error-adjusted (MW)", value: (r) => r.adjusted_mw },
    { label: `P${tail} (MW)`, value: (r) => r.low_mw },
    { label: `P${100 - tail} (MW)`, value: (r) => r.high_mw },
    { label: "Outturn (MW)", value: (r) => r.actual_mw },
    { label: "Outturn - adjusted (MW)", value: (r) => delta(r) },
    { label: "Lead time (h)", value: (r) => r.lead_hours },
    { label: "Run published (UTC)", value: (r) => r.publish_time },
  ];
}

/** Hour-by-hour numbers behind the chart: official, adjusted, outturn and their difference, in GW. */
export function HourTable({ day, coverage, showActual }: { day: DayAhead; coverage: number; showActual: boolean }) {
  const titleId = useId();
  const download = () =>
    downloadCsv(`wind-day-ahead-${day.delivery_date}-${day.decision.decision_time.replace(":", "")}.csv`, toCsv(csvColumns(coverage), day.hours));
  return (
    <section className="card hour-panel" aria-labelledby={titleId}>
      <div className="card-head">
        <div className="card-titles">
          <h2 className="card-title" id={titleId}>
            Hour by hour
          </h2>
        </div>
        <span className="caption">GW · Δ = out − adj</span>
        <button type="button" className="btn" onClick={download} title="Download the hourly numbers (MW) as CSV">
          CSV
        </button>
      </div>
      <div className="hour-scroll">
        <table className="hour-table">
          <caption className="visually-hidden">Hourly forecast and outturn in GW</caption>
          <thead>
            <tr>
              <th scope="col">HR</th>
              <th scope="col" title="Official WINDFOR forecast">OFF</th>
              <th scope="col" title="Error-adjusted forecast">ADJ</th>
              {showActual && (
                <>
                  <th scope="col" title="Metered outturn (hindsight)">OUT</th>
                  <th scope="col" title="Outturn minus error-adjusted forecast">Δ</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {day.hours.map((row) => {
              const diff = delta(row);
              return (
                <tr key={row.start_time}>
                  <td>{ukTime(row.start_time)}</td>
                  <td className="t-official">{gw1(row.forecast_mw)}</td>
                  <td className="t-adjusted">{gw1(row.adjusted_mw)}</td>
                  {showActual && (
                    <>
                      <td className="t-actual">{gw1(row.actual_mw)}</td>
                      <td className={deltaClass(diff)}>{deltaText(diff)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
