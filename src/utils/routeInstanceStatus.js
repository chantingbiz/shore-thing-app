import {
  addGregorianDaysToYmd,
  getEasternCalendarDateAtUtc,
  getEasternDayActivityBoundsUtc,
  getTodayEasternDate,
} from "../lib/easternDate.js";
import {
  getActivityLogsForTechnicianUtcRange,
  getServiceLogsForTechnicianPropertiesDateRange,
  mapWorkStateToServiceLogPatch,
  workStateFromServiceLogRow,
} from "../lib/api.js";
import { pickDisplayServiceLog } from "./completedSheetDisplayLog.js";
import {
  calendarDatesForRouteSheetWeek,
  serviceDatesForRouteTypeInSheetWeek,
} from "../lib/routeSheetWeek.js";
import { getServiceLogRow } from "../lib/supabaseStore.js";

/** Display strings — import these instead of duplicating literals in JSX. */
export const ROUTE_CARD_BADGE_LIVE = "LIVE";
export const ROUTE_CARD_BADGE_IN_PROGRESS = "IN PROGRESS";

/**
 * @param {{ isLive: boolean, isInProgress: boolean }} status
 * @returns {typeof ROUTE_CARD_BADGE_LIVE | typeof ROUTE_CARD_BADGE_IN_PROGRESS | null}
 */
export function getRouteCardBadgeLabel(status) {
  if (status.isLive) return ROUTE_CARD_BADGE_LIVE;
  if (status.isInProgress) return ROUTE_CARD_BADGE_IN_PROGRESS;
  return null;
}

/**
 * TEMP (field urgent): turnover work logged 2026-05-01 while sheet anchor is Sat 2026-05-02.
 * Remove when `route_sheet_item_id`-scoped logs exist.
 *
 * Stephen Turnover only; does **not** add April or other history.
 */
const URGENT_STEPHEN_TURNOVER_EXTRA_SERVICE_DATE = "2026-05-01";

function serviceLogFetchDatesForTechnicianRoute(
  technicianSlug,
  routeType,
  weekStartSaturdayYmd
) {
  const base = calendarDatesForRouteSheetWeek(weekStartSaturdayYmd);
  const slug = String(technicianSlug ?? "").toLowerCase().trim();
  const urgent = String(URGENT_STEPHEN_TURNOVER_EXTRA_SERVICE_DATE).trim();
  if (slug === "stephen" && routeType === "turnover" && urgent && !base.includes(urgent)) {
    return [...base, urgent];
  }
  return base;
}

/** Eastern YYYY-MM-DD set for merges + lookups (Stephen Turnover augments {@link calendarDatesForRouteSheetWeek}). */
export function technicianRouteSheetCalendarDateSet(
  technicianSlug,
  routeType,
  weekStartSaturdayYmd
) {
  return new Set(serviceLogFetchDatesForTechnicianRoute(technicianSlug, routeType, weekStartSaturdayYmd));
}

function ymdMinMax(ymds) {
  if (!ymds?.length) return { min: "", max: "" };
  let min = ymds[0];
  let max = ymds[0];
  for (const y of ymds) {
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return { min, max };
}

function easternYmdRangeToUtcHalfOpen(startYmd, endYmdInclusive) {
  const { startIso } = getEasternDayActivityBoundsUtc(startYmd);
  const dayAfter = addGregorianDaysToYmd(endYmdInclusive, 1);
  const { startIso: endExclusiveIso } = getEasternDayActivityBoundsUtc(dayAfter);
  return { startIso, endExclusiveIso };
}

/**
 * @param {unknown[]} rows
 * @returns {Map<string, Map<string, Record<string, unknown>>>}
 */
export function indexServiceLogsByPropertyAndDate(rows) {
  /** @type {Map<string, Map<string, Record<string, unknown>>>} */
  const out = new Map();
  for (const r of rows ?? []) {
    if (!r || typeof r !== "object") continue;
    const pid = String(r.property_id ?? "").trim();
    const sd = String(r.service_date ?? "").trim();
    if (!pid || !sd) continue;
    if (!out.has(pid)) out.set(pid, new Map());
    out.get(pid).set(sd, /** @type {Record<string, unknown>} */ (r));
  }
  return out;
}

/**
 * @param {unknown[]} events activity_logs rows
 * @param {Set<string>} allowedEasternYmd
 * @returns {Map<string, Set<string>>} property_id -> set of Eastern YYYY-MM-DD
 */
export function indexActivityPropertyDates(events, allowedEasternYmd) {
  /** @type {Map<string, Set<string>>} */
  const out = new Map();
  for (const e of events ?? []) {
    if (!e || typeof e !== "object") continue;
    const pid = String(e.property_id ?? "").trim();
    if (!pid) continue;
    const t = Date.parse(String(e.created_at ?? ""));
    if (!Number.isFinite(t)) continue;
    const ymd = getEasternCalendarDateAtUtc(t);
    if (!allowedEasternYmd.has(ymd)) continue;
    if (!out.has(pid)) out.set(pid, new Set());
    out.get(pid).add(ymd);
  }
  return out;
}

/**
 * Readings / chemicals / photos on the row (does not treat running hoses as “meaningful work”
 * for IN PROGRESS — those surface as LIVE instead).
 *
 * @param {Record<string, unknown> | null | undefined} row
 */
export function serviceLogRowHasMeaningfulNonHoseWork(row) {
  if (!row) return false;
  const ws = workStateFromServiceLogRow(row);
  if (!ws) return false;
  const patch = mapWorkStateToServiceLogPatch(ws);
  for (const v of Object.values(patch)) {
    if (String(v ?? "").trim() !== "") return true;
  }
  for (const k of [
    "pool_before_photo_url",
    "pool_after_photo_url",
    "spa_before_photo_url",
    "spa_after_photo_url",
  ]) {
    if (String(row[k] ?? "").trim() !== "") return true;
  }
  return false;
}

/**
 * True when the row has any saved pool/spa readings or chemicals-added fields (the ReadingsForm
 * payload). Does not include hose timestamps, activity_logs, or service photos.
 *
 * @param {Record<string, unknown> | null | undefined} row
 */
export function serviceLogRowHasChemReadingsEntered(row) {
  if (!row) return false;
  const ws = workStateFromServiceLogRow(row);
  if (!ws) return false;
  const patch = mapWorkStateToServiceLogPatch(ws);
  for (const v of Object.values(patch)) {
    if (String(v ?? "").trim() !== "") return true;
  }
  return false;
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function serviceLogRowHasActiveHose(row) {
  if (!row) return false;
  return !!(row.pool_hose_started_at || row.spa_hose_started_at);
}

/**
 * True when today's service_log row shows real work started (hose, readings/chems/photos, completion).
 * Used to relax LIVE / Finish Job when today is outside the nominal Sat–Sun / Mon–Fri service dates.
 *
 * @param {Record<string, unknown> | null | undefined} row
 */
export function rowIndicatesStartedWorkToday(row) {
  if (!row) return false;
  if (serviceLogRowHasActiveHose(row)) return true;
  if (serviceLogRowHasMeaningfulNonHoseWork(row)) return true;
  if (row.completed) return true;
  return false;
}

/** Same-property same–service_date merge: fetch wins over “today cache” stub when fetch has saved work */
function substantivePersistedWinsSameDayVsLiveCache(persisted, live) {
  if (!persisted || !live) return false;
  if (String(persisted.service_date ?? "").trim() !== String(live.service_date ?? "").trim()) return false;
  const pHeavy = rowIndicatesStartedWorkToday(persisted);
  const liveHeavy = rowIndicatesStartedWorkToday(live);
  return pHeavy && !liveHeavy;
}

/**
 * Core route-instance status used by technician lists, admin summaries, and dashboards.
 *
 * @param {object} input
 * @param {string} input.propertyId uuid
 * @param {string} input.weekStartDate Eastern Saturday anchor for route_sheet_items
 * @param {'turnover'|'midweek'} input.routeType
 * @param {Map<string, Map<string, Record<string, unknown>>>} input.logsByPropertyAndDate from {@link indexServiceLogsByPropertyAndDate}
 * @param {Map<string, Set<string>>} input.activityDatesByProperty from {@link indexActivityPropertyDates}
 * @param {Record<string, unknown> | null} [input.todayRowOverride] merged client row for “today” (hose timers)
 * @param {string} [input.todayEasternYmd] defaults to Eastern today
 * @param {string} [input.technicianSlug] when `stephen` + turnover, includes temporary carryover date 2026-05-01
 * @returns {{ isCompleted: boolean, isLive: boolean, isInProgress: boolean, allowFinishJob: boolean }}
 */
export function getRouteInstanceStatus({
  propertyId,
  weekStartDate,
  routeType,
  logsByPropertyAndDate,
  activityDatesByProperty,
  todayRowOverride = null,
  todayEasternYmd = getTodayEasternDate(),
  technicianSlug = "",
}) {
  const pid = String(propertyId ?? "").trim();
  const nominalDates = serviceDatesForRouteTypeInSheetWeek(weekStartDate, routeType);
  const nominalDateSet = new Set(nominalDates);
  const calendarWeekDates = serviceLogFetchDatesForTechnicianRoute(
    technicianSlug,
    routeType,
    weekStartDate
  );
  const byDate = logsByPropertyAndDate.get(pid) ?? new Map();

  const today = String(todayEasternYmd ?? "").trim();
  const todayInNominalWindow = nominalDateSet.has(today);

  /** Same per-day resolution as technician detail hydration (merge + optional live override). */
  const rowForDay = (d) => {
    if (d === today && todayRowOverride != null) {
      return /** @type {Record<string, unknown> | null} */ (todayRowOverride);
    }
    return /** @type {Record<string, unknown> | null} */ (byDate.get(d) ?? null);
  };

  const rawTodayRow = rowForDay(today);

  /** Saved work on this sheet: `route_sheet_items.week_start_date` … +6 Eastern days only. */
  const rowForInstanceScan = (d) => rowForDay(d);

  let isCompleted = false;
  for (const d of calendarWeekDates) {
    const row = rowForInstanceScan(d);
    if (row?.completed) {
      isCompleted = true;
      break;
    }
  }
  if (rawTodayRow?.completed) {
    isCompleted = true;
  }

  /** LIVE only for active hose on **today’s** `service_logs` calendar row (plus nominal-window days). */
  const canUseTodayRowForLive =
    todayInNominalWindow || !!(rawTodayRow && serviceLogRowHasActiveHose(rawTodayRow));
  const todayRowForLive = canUseTodayRowForLive ? rawTodayRow : null;
  const isLive = !!(todayRowForLive && serviceLogRowHasActiveHose(todayRowForLive));

  let allowFinishJob =
    todayInNominalWindow || rowIndicatesStartedWorkToday(rawTodayRow) || isCompleted;
  if (!allowFinishJob) {
    for (const d of calendarWeekDates) {
      if (rowIndicatesStartedWorkToday(rowForInstanceScan(d))) {
        allowFinishJob = true;
        break;
      }
    }
  }

  if (isCompleted) {
    return { isCompleted: true, isLive: false, isInProgress: false, allowFinishJob };
  }
  if (isLive) {
    return { isCompleted: false, isLive: true, isInProgress: false, allowFinishJob };
  }

  const actDates = activityDatesByProperty.get(pid) ?? new Set();
  let hasMeaningful = false;
  for (const d of calendarWeekDates) {
    const row = rowForInstanceScan(d);
    if (serviceLogRowHasMeaningfulNonHoseWork(row)) {
      hasMeaningful = true;
      break;
    }
    if (actDates.has(d)) {
      hasMeaningful = true;
      break;
    }
  }
  if (!todayInNominalWindow && rawTodayRow && serviceLogRowHasMeaningfulNonHoseWork(rawTodayRow)) {
    hasMeaningful = true;
  }
  if (!todayInNominalWindow && actDates.has(today)) {
    hasMeaningful = true;
  }

  return {
    isCompleted: false,
    isLive: false,
    isInProgress: hasMeaningful,
    allowFinishJob,
  };
}

/**
 * Sort key for technician route cards (lower = higher on the list).
 *
 * @param {{ isGuest: boolean, isCompleted: boolean, isLive: boolean, isInProgress: boolean }} p
 */
export function routeListSortTier({ isGuest, isCompleted, isLive, isInProgress }) {
  if (!isCompleted && isGuest && isLive) return 0;
  if (!isCompleted && isGuest && isInProgress) return 1;
  if (!isCompleted && isGuest) return 2;
  if (!isCompleted && !isGuest && isLive) return 3;
  if (!isCompleted && !isGuest && isInProgress) return 4;
  if (!isCompleted && !isGuest) return 5;
  if (isCompleted && isGuest) return 6;
  return 7;
}

/**
 * Loads `service_logs` + `activity_logs` for one sent sheet week (`week_start_date` … `+6` Eastern).
 *
 * @param {string} technicianSlug
 * @param {string} weekStartSaturdayYmd
 * @param {'turnover'|'midweek'} routeType
 * @param {string[]} propertyIds
 */
export async function fetchRouteInstanceContext(
  technicianSlug,
  weekStartSaturdayYmd,
  routeType,
  propertyIds
) {
  const nominalDates = serviceDatesForRouteTypeInSheetWeek(weekStartSaturdayYmd, routeType);
  const slug = String(technicianSlug ?? "").toLowerCase().trim();
  const spanDates = serviceLogFetchDatesForTechnicianRoute(slug, routeType, weekStartSaturdayYmd);
  const ids = [...new Set((propertyIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (!spanDates.length || !ids.length) {
    return {
      serviceDates: nominalDates,
      logsByPropertyAndDate: new Map(),
      activityDatesByProperty: new Map(),
    };
  }
  const { min, max } = ymdMinMax(spanDates);
  const { startIso, endExclusiveIso } = easternYmdRangeToUtcHalfOpen(min, max);
  const [logRows, activityRows] = await Promise.all([
    getServiceLogsForTechnicianPropertiesDateRange(slug, ids, min, max),
    getActivityLogsForTechnicianUtcRange(slug, startIso, endExclusiveIso),
  ]);
  const logsByPropertyAndDate = indexServiceLogsByPropertyAndDate(logRows);
  /** Attribute activity_logs only to Eastern days in the same fetch window as `service_logs`. */
  const allowed = new Set(spanDates);
  const activityDatesByProperty = indexActivityPropertyDates(activityRows, allowed);
  return { serviceDates: nominalDates, logsByPropertyAndDate, activityDatesByProperty };
}

/**
 * Prefer the in-memory “today” row for live hose timers after {@link fetchRouteInstanceContext}.
 *
 * @param {string} technicianSlug
 * @param {Map<string, Map<string, Record<string, unknown>>>} logsByPropertyAndDate
 * @param {string[]} propertyIds
 * @param {string} [todayYmd]
 * @param {Set<string> | null} [sheetWeekDatesEastern] when set, only merge when `todayYmd` is in this sheet week (avoids bleed from other calendars)
 */
export function mergeRealtimeTodayServiceLogsIntoIndex(
  technicianSlug,
  logsByPropertyAndDate,
  propertyIds,
  todayYmd = getTodayEasternDate(),
  sheetWeekDatesEastern = null
) {
  const slug = String(technicianSlug ?? "").toLowerCase().trim();
  const day = String(todayYmd ?? "").trim();
  if (!slug || !day) return logsByPropertyAndDate;
  if (sheetWeekDatesEastern instanceof Set && !sheetWeekDatesEastern.has(day)) {
    return logsByPropertyAndDate;
  }
  for (const pid of propertyIds ?? []) {
    const id = String(pid ?? "").trim();
    if (!id) continue;
    const live = getServiceLogRow(slug, id);
    if (!live) continue;
    if (!logsByPropertyAndDate.has(id)) logsByPropertyAndDate.set(id, new Map());
    const byDay = logsByPropertyAndDate.get(id);
    const persisted = /** @type {Record<string, unknown> | undefined} */ (byDay.get(day));
    if (substantivePersistedWinsSameDayVsLiveCache(persisted, live)) {
      byDay.set(day, persisted);
    } else {
      byDay.set(day, live);
    }
  }
  return logsByPropertyAndDate;
}

/**
 * Hydrate technician property detail: same route-instance window as {@link getRouteInstanceStatus}
 * (week + route_type service dates). Never prefers an empty “today” stub over a completed row on
 * another service_date in that window. Live hose on any day wins; otherwise {@link pickDisplayServiceLog}.
 *
 * @param {{
 *   technicianSlug: string,
 *   propertyId: string,
 *   weekStartDate: string,
 *   routeType: 'turnover'|'midweek',
 *   logsByPropertyAndDate: Map<string, Map<string, Record<string, unknown>>>,
 * }} input
 * @returns {Record<string, unknown> | null}
 */
export function pickTechnicianRouteDetailServiceLog({
  technicianSlug,
  propertyId,
  weekStartDate,
  routeType,
  logsByPropertyAndDate,
}) {
  const pid = String(propertyId ?? "").trim();
  const slug = String(technicianSlug ?? "").toLowerCase().trim();
  if (!pid || !slug) return null;

  const sheetDays = serviceLogFetchDatesForTechnicianRoute(slug, routeType, weekStartDate);
  mergeRealtimeTodayServiceLogsIntoIndex(
    slug,
    logsByPropertyAndDate,
    [pid],
    getTodayEasternDate(),
    technicianRouteSheetCalendarDateSet(slug, routeType, weekStartDate)
  );

  const nominalDates = serviceDatesForRouteTypeInSheetWeek(weekStartDate, routeType);
  const spanDates = sheetDays;
  const byDate = logsByPropertyAndDate.get(pid) ?? new Map();
  const today = getTodayEasternDate();
  const todayLive = getServiceLogRow(slug, pid);

  const mergedForDay = (d) => {
    if (d === today) {
      const persistedToday = /** @type {Record<string, unknown> | null} */ (
        byDate.get(d) ?? null
      );
      if (substantivePersistedWinsSameDayVsLiveCache(persistedToday, todayLive ?? null)) {
        return persistedToday;
      }
      return /** @type {Record<string, unknown> | null} */ (todayLive ?? persistedToday);
    }
    return /** @type {Record<string, unknown> | null} */ (byDate.get(d) ?? null);
  };

  /** TEMP: Stephen Turnover — prefer 2026-05-01 row when present (field work vs Sat sheet anchor). */
  const urgentDay = String(URGENT_STEPHEN_TURNOVER_EXTRA_SERVICE_DATE).trim();
  if (slug === "stephen" && routeType === "turnover" && urgentDay) {
    const r = /** @type {Record<string, unknown> | null} */ (mergedForDay(urgentDay));
    if (r && typeof r === "object") return r;
  }

  /** Scan nominal days first so display stays aligned with turnover/midweek when ties exist */
  const scanDays = [...new Set([...nominalDates, ...spanDates])];

  for (const d of scanDays) {
    const row = mergedForDay(d);
    if (row && serviceLogRowHasActiveHose(row)) {
      return /** @type {Record<string, unknown>} */ (row);
    }
  }

  const candidates = scanDays
    .map((d) => mergedForDay(d))
    .filter((r) => r && typeof r === "object");
  return pickDisplayServiceLog(/** @type {Record<string, unknown>[]} */ (candidates));
}

/*
 * --- Spa fill average tracking (future / Task 4) ---------------------------------------------
 * Hose drop/remove for the spa is recorded as `activity_logs` rows (`spa_hose_started`,
 * `spa_hose_stopped`) with human-readable labels — not as first-class duration rows.
 * Computing reliable “fill time to empty” averages should wait for structured data, e.g.:
 *   `hose_sessions` (property_id, hose_type enum pool|spa, started_at, ended_at,
 *   duration_seconds, service_date, technician_slug) written when a hose session ends.
 * Do not parse `event_label` text for durations.
 * --------------------------------------------------------------------------------------------
 */
