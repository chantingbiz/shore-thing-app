/** America/New_York calendar + UTC bounds for Supabase timestamptz filters. */

export const EASTERN_TIME_ZONE = "America/New_York";

/**
 * YYYY-MM-DD for the current instant in Eastern time (single definition of "today" for the app).
 */
export function getTodayEasternDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year");
  const m = get("month").padStart(2, "0");
  const d = get("day").padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Eastern calendar date (YYYY-MM-DD) at a UTC instant.
 * @param {number} utcMs
 */
export function getEasternCalendarDateAtUtc(utcMs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year");
  const m = get("month").padStart(2, "0");
  const d = get("day").padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Add whole calendar days to a Gregorian YYYY-MM-DD (for "tomorrow" / range defaults).
 * @param {string} ymd
 * @param {number} deltaDays
 */
export function addGregorianDaysToYmd(ymd, deltaDays) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const u = Date.UTC(y, mo - 1, d + deltaDays);
  const dt = new Date(u);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * First UTC millisecond where the Eastern calendar date equals `ymd`.
 * @param {string} ymd YYYY-MM-DD in America/New_York
 */
export function firstUtcInstantForEasternCalendarDay(ymd) {
  const [y, mo, d] = ymd.split("-").map(Number);
  let lo = Date.UTC(y, mo - 1, d - 2, 0, 0, 0);
  let hi = Date.UTC(y, mo - 1, d + 2, 0, 0, 0);
  while (getEasternCalendarDateAtUtc(lo) > ymd) lo -= 86400000;
  while (getEasternCalendarDateAtUtc(hi) < ymd) hi += 86400000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (getEasternCalendarDateAtUtc(mid) >= ymd) hi = mid;
    else lo = mid + 1;
  }
  while (lo > 0 && getEasternCalendarDateAtUtc(lo - 1) === ymd) lo--;
  return lo;
}

/**
 * UTC ISO range [start, end) for activity_logs.created_at matching one Eastern civil day.
 * @param {string} [ymd] defaults to Eastern "today"
 * @returns {{ startIso: string, endExclusiveIso: string }}
 */
export function getEasternDayActivityBoundsUtc(ymd = getTodayEasternDate()) {
  const startMs = firstUtcInstantForEasternCalendarDay(ymd);
  const nextYmd = addGregorianDaysToYmd(ymd, 1);
  const endExclusiveMs = firstUtcInstantForEasternCalendarDay(nextYmd);
  return {
    startIso: new Date(startMs).toISOString(),
    endExclusiveIso: new Date(endExclusiveMs).toISOString(),
  };
}
