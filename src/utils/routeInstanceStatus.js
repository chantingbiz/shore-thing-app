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
import { serviceDatesForRouteTypeInSheetWeek } from "../lib/routeSheetWeek.js";
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
 * @param {Record<string, unknown> | null | undefined} row
 */
export function serviceLogRowHasActiveHose(row) {
  if (!row) return false;
  return !!(row.pool_hose_started_at || row.spa_hose_started_at);
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
 * @returns {{ isCompleted: boolean, isLive: boolean, isInProgress: boolean }}
 */
export function getRouteInstanceStatus({
  propertyId,
  weekStartDate,
  routeType,
  logsByPropertyAndDate,
  activityDatesByProperty,
  todayRowOverride = null,
  todayEasternYmd = getTodayEasternDate(),
}) {
  const pid = String(propertyId ?? "").trim();
  const dates = serviceDatesForRouteTypeInSheetWeek(weekStartDate, routeType);
  const dateSet = new Set(dates);
  const byDate = logsByPropertyAndDate.get(pid) ?? new Map();

  const today = String(todayEasternYmd ?? "").trim();
  const todayInWindow = dateSet.has(today);

  /** Same per-day resolution as technician detail hydration (merge + optional live override). */
  const rowForDay = (d) => {
    if (d === today && todayRowOverride != null) {
      return /** @type {Record<string, unknown> | null} */ (todayRowOverride);
    }
    return /** @type {Record<string, unknown> | null} */ (byDate.get(d) ?? null);
  };

  let isCompleted = false;
  for (const d of dates) {
    const row = rowForDay(d);
    if (row?.completed) {
      isCompleted = true;
      break;
    }
  }

  const todayRow = todayInWindow ? rowForDay(today) : null;

  const isLive = !!(todayRow && serviceLogRowHasActiveHose(todayRow));

  if (isCompleted) {
    return { isCompleted: true, isLive: false, isInProgress: false };
  }
  if (isLive) {
    return { isCompleted: false, isLive: true, isInProgress: false };
  }

  const actDates = activityDatesByProperty.get(pid) ?? new Set();
  let hasMeaningful = false;
  for (const d of dates) {
    const row = rowForDay(d);
    if (serviceLogRowHasMeaningfulNonHoseWork(row)) {
      hasMeaningful = true;
      break;
    }
    if (actDates.has(d)) {
      hasMeaningful = true;
      break;
    }
  }

  return {
    isCompleted: false,
    isLive: false,
    isInProgress: hasMeaningful,
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
 * Loads `service_logs` + `activity_logs` for the route-type service window (Sat–Sun or Mon–Fri).
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
  const dates = serviceDatesForRouteTypeInSheetWeek(weekStartSaturdayYmd, routeType);
  const ids = [...new Set((propertyIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (!dates.length || !ids.length) {
    return {
      serviceDates: dates,
      logsByPropertyAndDate: new Map(),
      activityDatesByProperty: new Map(),
    };
  }
  const { min, max } = ymdMinMax(dates);
  const { startIso, endExclusiveIso } = easternYmdRangeToUtcHalfOpen(min, max);
  const slug = String(technicianSlug ?? "").toLowerCase().trim();
  const [logRows, activityRows] = await Promise.all([
    getServiceLogsForTechnicianPropertiesDateRange(slug, ids, min, max),
    getActivityLogsForTechnicianUtcRange(slug, startIso, endExclusiveIso),
  ]);
  const logsByPropertyAndDate = indexServiceLogsByPropertyAndDate(logRows);
  const allowed = new Set(dates);
  const activityDatesByProperty = indexActivityPropertyDates(activityRows, allowed);
  return { serviceDates: dates, logsByPropertyAndDate, activityDatesByProperty };
}

/**
 * Prefer the in-memory “today” row for live hose timers after {@link fetchRouteInstanceContext}.
 *
 * @param {string} technicianSlug
 * @param {Map<string, Map<string, Record<string, unknown>>>} logsByPropertyAndDate
 * @param {string[]} propertyIds
 * @param {string} [todayYmd]
 */
export function mergeRealtimeTodayServiceLogsIntoIndex(
  technicianSlug,
  logsByPropertyAndDate,
  propertyIds,
  todayYmd = getTodayEasternDate()
) {
  const slug = String(technicianSlug ?? "").toLowerCase().trim();
  const day = String(todayYmd ?? "").trim();
  if (!slug || !day) return logsByPropertyAndDate;
  for (const pid of propertyIds ?? []) {
    const id = String(pid ?? "").trim();
    if (!id) continue;
    const live = getServiceLogRow(slug, id);
    if (!live) continue;
    if (!logsByPropertyAndDate.has(id)) logsByPropertyAndDate.set(id, new Map());
    logsByPropertyAndDate.get(id).set(day, live);
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

  mergeRealtimeTodayServiceLogsIntoIndex(slug, logsByPropertyAndDate, [pid]);

  const dates = serviceDatesForRouteTypeInSheetWeek(weekStartDate, routeType);
  const byDate = logsByPropertyAndDate.get(pid) ?? new Map();
  const today = getTodayEasternDate();
  const todayLive = getServiceLogRow(slug, pid);

  const mergedForDay = (d) =>
    d === today ? (todayLive ?? byDate.get(d) ?? null) : byDate.get(d) ?? null;

  for (const d of dates) {
    const row = mergedForDay(d);
    if (row && serviceLogRowHasActiveHose(row)) {
      return /** @type {Record<string, unknown>} */ (row);
    }
  }

  const candidates = dates
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
