// Thin, typed wrapper around the backend's JSON API.

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Same origin by default (Vite proxy in dev, FastAPI or Vercel routing in production).
const API_BASE: string = import.meta.env.VITE_API_BASE ?? "";

type Params = Record<string, string | number | undefined>;

export function apiUrl(path: string, params: Params = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const search = query.toString();
  return `${API_BASE}/api/${path}${search ? `?${search}` : ""}`;
}

export const endpoints = {
  meta: () => apiUrl("meta"),
  dayAhead: (date: string, decisionTime: string, coverage: number) =>
    apiUrl("day-ahead", { date, decision_time: decisionTime, coverage }),
  accuracy: (decisionTime: string, coverage: number) => apiUrl("accuracy", { decision_time: decisionTime, coverage }),
  horizon: () => apiUrl("horizon"),
};

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    let detail = `Request failed (HTTP ${response.status})`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "detail" in body && typeof body.detail === "string") {
        detail = body.detail;
      }
    } catch {
      // Non-JSON error body: keep the generic message.
    }
    throw new ApiError(detail, response.status);
  }
  return (await response.json()) as T;
}
