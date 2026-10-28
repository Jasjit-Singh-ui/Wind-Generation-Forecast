// Display formatting. Instants (UTC ISO strings from the API) are always shown in UK local
// time - the market's clock - whatever the viewer's own time zone is. Calendar dates
// ("2026-01-15") are plain dates and are never shifted.

const UK = "Europe/London";
const LOCALE = "en-GB";

const ukTimeFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: UK, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const ukDayFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: UK, weekday: "short", day: "numeric", month: "short" });
const ukHourFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: UK, hour: "numeric", hourCycle: "h23" });
const calendarFormats = {
  short: new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", day: "numeric", month: "short" }),
  weekday: new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }),
  medium: new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" }),
  long: new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }),
};

const MINUS = "−";

type Instant = string | number | Date;

/** "09:20" in UK local time. */
export function ukTime(instant: Instant): string {
  return ukTimeFormat.format(new Date(instant));
}

/** "Thu 15 Jan" in UK local time. */
export function ukDay(instant: Instant): string {
  return ukDayFormat.format(new Date(instant));
}

/** "Thu 15 Jan, 09:20" in UK local time. */
export function ukDayTime(instant: Instant): string {
  return `${ukDay(instant)}, ${ukTime(instant)}`;
}

/** UK local hour of day, 0-23. */
export function ukHour(instant: Instant): number {
  return Number(ukHourFormat.format(new Date(instant)));
}

/** Format a calendar date ("2026-01-15") without any time-zone shift. */
export function calendarDate(ymd: string, style: keyof typeof calendarFormats = "medium"): string {
  return calendarFormats[style].format(new Date(`${ymd}T00:00:00Z`));
}

/** Add days to a calendar date string. */
export function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function number(value: number, digits = 0): string {
  return value.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Typographic minus for negative numbers. */
function withSign(value: number, text: string, explicitPlus: boolean): string {
  if (value < 0) return `${MINUS}${text}`;
  return explicitPlus && value > 0 ? `+${text}` : text;
}

export const DASH = "–";

export function mw(value: number | null | undefined, opts: { signed?: boolean } = {}): string {
  if (value == null) return DASH;
  return withSign(value, `${number(Math.abs(value))} MW`, opts.signed ?? false);
}

export function gw(value: number | null | undefined, opts: { digits?: number; signed?: boolean } = {}): string {
  if (value == null) return DASH;
  return withSign(value, `${number(Math.abs(value) / 1000, opts.digits ?? 1)} GW`, opts.signed ?? false);
}

/** Energy from MWh, shown in GWh. */
export function gwh(valueMwh: number | null | undefined, digits = 0): string {
  if (valueMwh == null) return DASH;
  return withSign(valueMwh, `${number(Math.abs(valueMwh) / 1000, digits)} GWh`, false);
}

export function pct(value: number | null | undefined, opts: { digits?: number; signed?: boolean } = {}): string {
  if (value == null) return DASH;
  return withSign(value, `${number(Math.abs(value), opts.digits ?? 0)}%`, opts.signed ?? false);
}

/** Axis tick in GW: "0", "5 GW", "12.5 GW". */
export function gwTick(valueMw: number): string {
  if (valueMw === 0) return "0";
  const value = valueMw / 1000;
  const digits = Number.isInteger(value) ? 0 : Number.isInteger(value * 10) ? 1 : 2;
  return withSign(value, `${number(Math.abs(value), digits)} GW`, false);
}

/** "1 h 50 min", "45 min". */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "16.5" hours with at most one decimal. */
export function hoursLabel(value: number | null | undefined): string {
  if (value == null) return DASH;
  return `${number(value, Number.isInteger(value) ? 0 : 1)} h`;
}

/** Relative change of `value` versus `base`, in percent. */
export function relativeChange(value: number | null | undefined, base: number | null | undefined): number | null {
  if (value == null || base == null || base === 0) return null;
  return (100 * (value - base)) / base;
}

/** "HH:MM" to minutes after midnight. */
export function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const ukDateKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: UK, year: "numeric", month: "2-digit", day: "2-digit" });

/** UK local calendar date of an instant, as "YYYY-MM-DD". */
export function ukDateKey(instant: Instant): string {
  return ukDateKeyFormat.format(new Date(instant));
}

/** Plain number with thousands separators, e.g. "9,695". */
export function fmt(value: number | null | undefined, digits = 0): string {
  if (value == null) return DASH;
  return withSign(value, number(Math.abs(value), digits), false);
}

/** Signed plain number, e.g. "+1,746" / "−280". */
export function fmtSigned(value: number | null | undefined, digits = 0): string {
  if (value == null) return DASH;
  return withSign(value, number(Math.abs(value), digits), true);
}

const weekdayFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "long" });
const dayMonthYearFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

/** { weekday: "Sunday", date: "1 February 2026" } for a calendar date. */
export function calendarParts(ymd: string): { weekday: string; date: string } {
  const instant = new Date(`${ymd}T00:00:00Z`);
  return { weekday: weekdayFormat.format(instant), date: dayMonthYearFormat.format(instant) };
}

/** "Sat 31 Jan · 09:20" on the UK clock. */
export function ukStamp(instant: Instant): string {
  return `${ukDay(instant)} · ${ukTime(instant)}`;
}
