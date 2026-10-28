import { useCallback, useEffect, useState } from "react";

export type View = "day" | "accuracy" | "method";
const VIEWS: readonly View[] = ["day", "accuracy", "method"];

/** Everything needed to reproduce a screen, kept in the query string so links can be shared. */
export interface UrlState {
  view: View;
  date?: string; // delivery day, YYYY-MM-DD
  time?: string; // decision time on D-1, HH:MM (UK)
  coverage?: number; // prediction interval width, %
}

function readUrl(): UrlState {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const date = params.get("date");
  const time = params.get("t");
  const coverage = Number(params.get("range"));
  return {
    view: VIEWS.includes(view as View) ? (view as View) : "day",
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    time: time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : undefined,
    coverage: Number.isInteger(coverage) && coverage > 0 ? coverage : undefined,
  };
}

function writeUrl(state: UrlState): void {
  const params = new URLSearchParams();
  if (state.view !== "day") params.set("view", state.view);
  if (state.date) params.set("date", state.date);
  if (state.time) params.set("t", state.time);
  if (state.coverage) params.set("range", String(state.coverage));
  const search = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
}

export function useUrlState(): [UrlState, (patch: Partial<UrlState>) => void] {
  const [state, setState] = useState<UrlState>(readUrl);
  useEffect(() => writeUrl(state), [state]);
  const update = useCallback((patch: Partial<UrlState>) => setState((previous) => ({ ...previous, ...patch })), []);
  return [state, update];
}
