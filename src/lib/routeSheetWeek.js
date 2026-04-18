import {
  EASTERN_TIME_ZONE,
  addGregorianDaysToYmd,
  firstUtcInstantForEasternCalendarDay,
  getEasternCalendarDateAtUtc,
} from "./easternDate.js";

/** Sat→Fri order; offsets match `ROUTE_DAY_KEY_OFFSET` (0 = Saturday of the active sheet week). */
const ROUTE_SHEET_DAY_KEYS_IN_ORDER = Object.freeze([
  "saturday",
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
]);

/** Offsets from route-sheet Saturday (Sat–Fri) for dashboard day chips. */
const ROUTE_DAY_KEY_OFFSET = Object.freeze({
  saturday: 0,
  sunday: 1,
  monday: 2,
  tuesday: 3,
  wednesday: 4,
  thursday: 5,
  friday: 6,
});

function easternWeekdayShortFromUtcMs(ms) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    weekday: "short",
  }).format(new Date(ms));
}

/**
 * Eastern Saturday `YYYY-MM-DD` for the Sat–Fri business week that contains `easternYmd`.
 * @param {string} easternYmd
 */
export function easternSaturdayOnOrBeforeDate(easternYmd) {
  let ms = firstUtcInstantForEasternCalendarDay(easternYmd);
  for (let i = 0; i < 7; i++) {
    if (easternWeekdayShortFromUtcMs(ms).startsWith("Sat")) {
      return getEasternCalendarDateAtUtc(ms);
    }
    ms -= 86400000;
  }
  return easternYmd;
}

function easternThursdayAfterSaturday(saturdayYmd) {
  return addGregorianDaysToYmd(saturdayYmd, 5);
}

/**
 * First UTC instant when America/New_York civil time is `hour24:minute24` on `easternYmd`.
 * @param {string} easternYmd
 * @param {number} hour24
 * @param {number} minute24
 */
export function easternWallClockMinuteUtcMs(easternYmd, hour24, minute24) {
  const dayStart = firstUtcInstantForEasternCalendarDay(easternYmd);
  const nextYmd = addGregorianDaysToYmd(easternYmd, 1);
  const dayEndExcl = firstUtcInstantForEasternCalendarDay(nextYmd);
  for (let ms = dayStart; ms < dayEndExcl; ms += 60 * 1000) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TIME_ZONE,
      hour: "numeric",
      hour12: false,
      hourCycle: "h23",
      minute: "numeric",
    }).formatToParts(new Date(ms));
    const h = Number(parts.find((x) => x.type === "hour")?.value ?? -1);
    const m = Number(parts.find((x) => x.type === "minute")?.value ?? -1);
    if (h === hour24 && m === minute24) return ms;
  }
  return dayStart + (hour24 * 60 + minute24) * 60 * 1000;
}

/**
 * Active route-sheet week anchor: Saturday `YYYY-MM-DD` (Eastern).
 * Rollover: at/after Thursday 7:00 AM Eastern in that Sat–Fri week, advance to the following Saturday.
 *
 * @param {Date} [now]
 * @returns {string} YYYY-MM-DD (Eastern Saturday) — use for `route_sheet_items.week_start_date`
 */
export function getActiveRouteSheetSaturdayEastern(now = new Date()) {
  const todayYmd = getEasternCalendarDateAtUtc(now.getTime());
  const s0 = easternSaturdayOnOrBeforeDate(todayYmd);
  const thursdayYmd = easternThursdayAfterSaturday(s0);
  const rolloverMs = easternWallClockMinuteUtcMs(thursdayYmd, 7, 0);
  if (now.getTime() < rolloverMs) return s0;
  return addGregorianDaysToYmd(s0, 7);
}

/**
 * Display label, e.g. "Week of Saturday 4/19/26".
 * @param {string} saturdayYmd
 */
export function getRouteSheetWeekLabel(saturdayYmd) {
  const [y, mo, d] = saturdayYmd.split("-").map(Number);
  const loc = new Date(y, mo - 1, d);
  const shortDate = loc.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
  return `Week of Saturday ${shortDate}`;
}

/**
 * Eastern calendar `YYYY-MM-DD` for a day chip relative to the active route-sheet Saturday.
 * @param {string} routeSheetSaturdayYmd
 * @param {string} dayKey e.g. `saturday` … `friday`
 */
export function calendarDateForRouteSheetDay(routeSheetSaturdayYmd, dayKey) {
  const off = ROUTE_DAY_KEY_OFFSET[dayKey];
  if (off === undefined) return routeSheetSaturdayYmd;
  return addGregorianDaysToYmd(routeSheetSaturdayYmd, off);
}

/** Short `M/D` for chip labels (matches dashboard examples like 4/18). */
export function formatDayChipMd(ymd) {
  const parts = String(ymd ?? "").split("-");
  if (parts.length !== 3) return "";
  const mo = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(mo) || !Number.isFinite(d)) return "";
  return `${mo}/${d}`;
}

/**
 * Which route-sheet calendar day (`saturday`…`friday`) an Eastern `YYYY-MM-DD` falls on
 * for a given route-sheet week anchor (Eastern Saturday `week_start_date`).
 *
 * @param {string} weekStartSaturdayYmd
 * @param {string} easternYmd
 * @returns {string}
 */
export function routeSheetDayKeyForEasternYmdInWeek(weekStartSaturdayYmd, easternYmd) {
  const anchor = String(weekStartSaturdayYmd ?? "").trim();
  const ymd = String(easternYmd ?? "").trim();
  if (!anchor || !ymd) return "saturday";
  for (let i = 0; i < ROUTE_SHEET_DAY_KEYS_IN_ORDER.length; i++) {
    if (addGregorianDaysToYmd(anchor, i) === ymd) return ROUTE_SHEET_DAY_KEYS_IN_ORDER[i];
  }
  return "saturday";
}

/**
 * Turnover vs midweek for dashboard day chips — **keep in sync** with
 * `sheetTypeForCalendarDay` in `routeSheetDashboardMock.js` (Sat/Sun → turnover, Mon–Fri → midweek).
 *
 * @param {string} dayKey `saturday` … `friday`
 * @returns {'turnover'|'midweek'}
 */
export function operationalRouteSheetTypeForDayKey(dayKey) {
  const k = String(dayKey ?? "").toLowerCase();
  if (k === "saturday" || k === "sunday") return "turnover";
  return "midweek";
}

/**
 * Operational route-sheet type for “today” using Eastern calendar date, active route-sheet week
 * (`getActiveRouteSheetSaturdayEastern`), and the same Sat/Sun vs weekday split as the dashboard.
 *
 * @param {Date} [now]
 * @returns {'turnover'|'midweek'}
 */
export function getOperationalRouteSheetTypeForToday(now = new Date()) {
  const weekSat = getActiveRouteSheetSaturdayEastern(now);
  const todayYmd = getEasternCalendarDateAtUtc(now.getTime());
  const dayKey = routeSheetDayKeyForEasternYmdInWeek(weekSat, todayYmd);
  return operationalRouteSheetTypeForDayKey(dayKey);
}
