import { useCallback } from "react";
import { endpoints } from "./api/client";
import type { Meta } from "./api/types";
import { ErrorState, Loading } from "./components/StateBox";
import { WindBackdrop } from "./components/WindBackdrop";
import { useApi } from "./hooks/useApi";
import { useUrlState, type UrlState, type View } from "./hooks/useUrlState";
import { calendarDate, ukDayTime } from "./lib/format";
import { AccuracyPage } from "./pages/AccuracyPage";
import { DayAheadPage } from "./pages/DayAheadPage";
import { MethodologyPage } from "./pages/MethodologyPage";

const TABS: { id: View; label: string }[] = [
  { id: "day", label: "Day-ahead view" },
  { id: "accuracy", label: "Forecast accuracy" },
  { id: "method", label: "Methodology" },
];

export default function App() {
  const meta = useApi<Meta>(endpoints.meta());
  const [state, update] = useUrlState();

  return (
    <>
      <WindBackdrop />
      <div className="app-layer">
        <header className="shell">
          <div className="topbar">
            <div className="brand">
              <span className="logo" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3.5 3.5 0 1 1-3.5 3.5M3 19h7" />
                </svg>
              </span>
              <div>
                <div className="brand-name">Wind Forecast Monitor</div>
                <div className="brand-tag">GB day-ahead wind · pilot for January 2026 purchase decisions</div>
              </div>
            </div>
            <span className="source-pill">Elexon BMRS · FUELHH &amp; WINDFOR</span>
          </div>
          <nav className="tabs" aria-label="Views">
            <div className="pill-group" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  type="button"
                  role="tab"
                  className="pill"
                  aria-selected={state.view === tab.id}
                  aria-controls="view-panel"
                  onClick={() => update({ view: tab.id })}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>
        </header>

        <main className="shell page-main" id="view-panel" role="tabpanel" aria-labelledby={`tab-${state.view}`}>
          {meta.error ? (
            <ErrorState error={meta.error} onRetry={meta.retry} />
          ) : !meta.data ? (
            <Loading label="Connecting to the forecast service" />
          ) : (
            <Workspace meta={meta.data} state={state} update={update} />
          )}
        </main>

        {meta.data && (
          <footer className="shell app-footer">
            Data: Elexon BMRS (FUELHH wind outturn, WINDFOR wind forecast) · decisions{" "}
            {calendarDate(meta.data.window.first_decision_date, "short")}–{calendarDate(meta.data.window.last_decision_date, "short")} 2026
            {meta.data.data.fetched_at && <> · snapshot {ukDayTime(meta.data.data.fetched_at)}</>} · all times UK (Europe/London)
          </footer>
        )}
      </div>
    </>
  );
}

function Workspace({ meta, state, update }: { meta: Meta; state: UrlState; update: (patch: Partial<UrlState>) => void }) {
  const { first_delivery_date: firstDay, last_delivery_date: lastDay } = meta.window;
  const date = state.date && state.date >= firstDay && state.date <= lastDay ? state.date : firstDay;
  const decisionTime = state.time ?? meta.default_decision_time;
  const coverage =
    state.coverage && meta.calibration.coverages.includes(state.coverage) ? state.coverage : meta.calibration.default_coverage;

  const setDate = useCallback((value: string) => update({ date: value }), [update]);
  const setTime = useCallback((value: string) => update({ time: value }), [update]);
  const setCoverage = useCallback((value: number) => update({ coverage: value }), [update]);
  const openDay = useCallback(
    (value: string) => {
      update({ view: "day", date: value });
      window.scrollTo({ top: 0 });
    },
    [update],
  );

  if (state.view === "accuracy") {
    return (
      <AccuracyPage
        meta={meta}
        decisionTime={decisionTime}
        coverage={coverage}
        onOpenDay={openDay}
        onDecisionTimeChange={setTime}
        onCoverageChange={setCoverage}
      />
    );
  }
  if (state.view === "method") return <MethodologyPage meta={meta} />;
  return (
    <DayAheadPage
      meta={meta}
      date={date}
      decisionTime={decisionTime}
      coverage={coverage}
      onDateChange={setDate}
      onDecisionTimeChange={setTime}
      onCoverageChange={setCoverage}
    />
  );
}
