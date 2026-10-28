import { useCallback, useEffect, useState } from "react";
import { getJson } from "../api/client";

// API responses are immutable for a given URL (the data is a historical snapshot), so one
// in-flight/settled promise per URL is shared by every consumer. Failures are evicted so a
// retry refetches.
const responses = new Map<string, Promise<unknown>>();

function load<T>(url: string): Promise<T> {
  let pending = responses.get(url);
  if (!pending) {
    pending = getJson<T>(url);
    responses.set(url, pending);
    pending.catch(() => responses.delete(url));
  }
  return pending as Promise<T>;
}

export interface ApiState<T> {
  data: T | undefined;
  error: Error | undefined;
  /** A request for the current URL is in flight. */
  loading: boolean;
  /** `data` belongs to a previous request and stays on screen while the new one loads. */
  stale: boolean;
  retry: () => void;
}

interface Settled<T> {
  url: string;
  attempt: number;
  data?: T;
  error?: Error;
}

/** Fetch JSON for `url` (nothing for `null`), keeping the last result on screen while reloading. */
export function useApi<T>(url: string | null): ApiState<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (url === null) return;
    let ignore = false;
    load<T>(url).then(
      (data) => {
        if (!ignore) setSettled({ url, attempt, data });
      },
      (error: unknown) => {
        if (!ignore) setSettled({ url, attempt, error: error instanceof Error ? error : new Error(String(error)) });
      },
    );
    return () => {
      ignore = true;
    };
  }, [url, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const current = settled?.url === url && settled.attempt === attempt ? settled : undefined;
  return {
    data: current ? current.data : settled?.data,
    error: current?.error,
    loading: url !== null && current === undefined,
    stale: current === undefined && settled?.data !== undefined,
    retry,
  };
}
