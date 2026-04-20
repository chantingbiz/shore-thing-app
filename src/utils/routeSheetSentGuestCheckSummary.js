import { getRouteSheetItemsForWeek } from "../lib/api.js";
import {
  getActiveRouteSheetSaturdayEastern,
  serviceDatesForRouteTypeInSheetWeek,
} from "../lib/routeSheetWeek.js";
import {
  ensurePropertiesById,
  ensureServiceLogsForToday,
  getPropertyById,
} from "../lib/supabaseStore.js";
import { getTodayEasternDate } from "../lib/easternDate.js";
import {
  fetchRouteInstanceContext,
  getRouteInstanceStatus,
  mergeRealtimeTodayServiceLogsIntoIndex,
  serviceLogRowHasChemReadingsEntered,
} from "./routeInstanceStatus.js";

/** Sent weekly rows only (dashboard sets `sent_at` on send). */
export function isRouteSheetRowSent(row) {
  const s = row?.sent_at;
  return s != null && String(s).trim() !== "";
}

/**
 * Row counts toward operational workload (excluded rows stay in DB but are not counted).
 * @param {Record<string, unknown>} row
 */
export function isRouteSheetRowIncludedOnActiveSheet(row) {
  const inc = row?.included;
  if (inc === false || inc === 0) return false;
  if (typeof inc === "string" && inc.toLowerCase() === "false") return false;
  return true;
}

/**
 * Guest/check totals from sent `route_sheet_items` for the week; completed and in-progress
 * counts use {@link getRouteInstanceStatus} scoped to this `route_type`’s Eastern service dates
 * in the sheet week (Sat–Sun turnover vs Mon–Fri midweek), not only “today”.
 *
 * Count rules:
 * - **Turnover:** sent rows with `included` on active sheet; split by `guest_check`.
 * - **Midweek:** same sent + included filter, but only **guest** rows count toward workload;
 *   check totals are always 0 (revisit sheet is guest-only in summaries).
 *
 * @param {string} technicianSlug
 * @param {'turnover'|'midweek'} routeType
 * @param {{ weekStartDate?: string }} [opts]
 * @returns {Promise<{ guestTotal: number, guestCompleted: number, guestInProgress: number, checkTotal: number, checkCompleted: number, checkInProgress: number, weekStartDate: string, midweekGuestsOnly: boolean }>}
 */
export async function fetchRouteSheetSentGuestCheckSummary(
  technicianSlug,
  routeType,
  opts = {}
) {
  const slug = String(technicianSlug ?? "").toLowerCase().trim();
  const weekStartDate =
    String(opts.weekStartDate ?? "").trim() || getActiveRouteSheetSaturdayEastern();
  const midweekGuestsOnly = routeType === "midweek";

  if (!slug || (routeType !== "turnover" && routeType !== "midweek")) {
    return {
      guestTotal: 0,
      guestCompleted: 0,
      guestInProgress: 0,
      checkTotal: 0,
      checkCompleted: 0,
      checkInProgress: 0,
      weekStartDate,
      midweekGuestsOnly,
    };
  }

  const items = await getRouteSheetItemsForWeek(weekStartDate, routeType, slug);
  const sent = (items ?? []).filter(isRouteSheetRowSent);
  const active = sent.filter(isRouteSheetRowIncludedOnActiveSheet);
  const workloadRows = midweekGuestsOnly
    ? active.filter((r) => r.guest_check === "guest")
    : active;

  const propertyIds = [
    ...new Set(workloadRows.map((r) => String(r.property_id ?? "").trim()).filter(Boolean)),
  ];

  await ensurePropertiesById(propertyIds);
  await ensureServiceLogsForToday(slug);

  const { logsByPropertyAndDate, activityDatesByProperty } = await fetchRouteInstanceContext(
    slug,
    weekStartDate,
    routeType,
    propertyIds
  );
  mergeRealtimeTodayServiceLogsIntoIndex(
    slug,
    logsByPropertyAndDate,
    propertyIds,
    getTodayEasternDate()
  );

  let guestTotal = 0;
  let guestCompleted = 0;
  let guestInProgress = 0;
  let checkTotal = 0;
  let checkCompleted = 0;
  let checkInProgress = 0;

  for (const row of workloadRows) {
    const isGuest = row.guest_check === "guest";
    if (isGuest) guestTotal += 1;
    else checkTotal += 1;

    const pid = String(row.property_id ?? "").trim();
    const st = getRouteInstanceStatus({
      propertyId: pid,
      weekStartDate,
      routeType,
      logsByPropertyAndDate,
      activityDatesByProperty,
    });
    const wip = !st.isCompleted && (st.isLive || st.isInProgress);
    if (isGuest) {
      if (st.isCompleted) guestCompleted += 1;
      else if (wip) guestInProgress += 1;
    } else {
      if (st.isCompleted) checkCompleted += 1;
      else if (wip) checkInProgress += 1;
    }
  }

  const debugCounts =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window?.localStorage?.getItem("debugRouteSheetSentCounts") === "1";
  if (debugCounts) {
    console.log("[route sheet sent counts]", {
      week_start_date: weekStartDate,
      technician_slug: slug,
      route_type: routeType,
      rows_loaded: items?.length ?? 0,
      sent_rows: sent.length,
      included_rows: active.length,
      workload_rows: workloadRows.length,
      midweek_guests_only: midweekGuestsOnly,
      guest: `${guestCompleted}/${guestTotal} done · ${guestInProgress} active`,
      check: `${checkCompleted}/${checkTotal} done · ${checkInProgress} active`,
    });
  }

  if (midweekGuestsOnly) {
    return {
      guestTotal,
      guestCompleted,
      guestInProgress,
      checkTotal: 0,
      checkCompleted: 0,
      checkInProgress: 0,
      weekStartDate,
      midweekGuestsOnly: true,
    };
  }

  return {
    guestTotal,
    guestCompleted,
    guestInProgress,
    checkTotal,
    checkCompleted,
    checkInProgress,
    weekStartDate,
    midweekGuestsOnly: false,
  };
}

/**
 * True when at least one property on the sent+included workload for this route type has saved
 * readings or chemicals on a `service_logs` row for a `service_date` in that route type's sheet
 * week window. Hose timers, activity_logs-only, and photos do not count.
 *
 * @param {string} technicianSlug
 * @param {'turnover'|'midweek'} routeType
 * @param {{ weekStartDate?: string }} [opts]
 */
export async function sentSheetHasChemReadingsEnteredForRouteWindow(
  technicianSlug,
  routeType,
  opts = {}
) {
  const slug = String(technicianSlug ?? "").toLowerCase().trim();
  const weekStartDate =
    String(opts.weekStartDate ?? "").trim() || getActiveRouteSheetSaturdayEastern();
  const midweekGuestsOnly = routeType === "midweek";

  if (!slug || (routeType !== "turnover" && routeType !== "midweek")) {
    return false;
  }

  const items = await getRouteSheetItemsForWeek(weekStartDate, routeType, slug);
  const sent = (items ?? []).filter(isRouteSheetRowSent);
  const active = sent.filter(isRouteSheetRowIncludedOnActiveSheet);
  const workloadRows = midweekGuestsOnly
    ? active.filter((r) => r.guest_check === "guest")
    : active;

  const propertyIds = [
    ...new Set(workloadRows.map((r) => String(r.property_id ?? "").trim()).filter(Boolean)),
  ];
  if (!propertyIds.length) return false;

  await ensurePropertiesById(propertyIds);
  await ensureServiceLogsForToday(slug);

  const { logsByPropertyAndDate } = await fetchRouteInstanceContext(
    slug,
    weekStartDate,
    routeType,
    propertyIds
  );
  mergeRealtimeTodayServiceLogsIntoIndex(
    slug,
    logsByPropertyAndDate,
    propertyIds,
    getTodayEasternDate()
  );

  const dates = serviceDatesForRouteTypeInSheetWeek(weekStartDate, routeType);
  for (const pid of propertyIds) {
    const byDate = logsByPropertyAndDate.get(pid) ?? new Map();
    for (const d of dates) {
      const row = /** @type {Record<string, unknown> | null} */ (byDate.get(d) ?? null);
      if (serviceLogRowHasChemReadingsEntered(row)) return true;
    }
  }
  return false;
}

/**
 * True when every counted row on the sent sheet (included, route-type rules) is completed
 * and none are live / in-progress — suitable for archive-readiness UI per technician + route_type + week.
 *
 * @param {Awaited<ReturnType<typeof fetchRouteSheetSentGuestCheckSummary>>} summary
 */
export function isSentSheetFullyArchiveReady(summary) {
  if (!summary || typeof summary !== "object") return false;
  const {
    guestTotal,
    guestCompleted,
    guestInProgress,
    checkTotal,
    checkCompleted,
    checkInProgress,
    midweekGuestsOnly,
  } = summary;
  if (midweekGuestsOnly) {
    if (guestTotal === 0) return false;
    return guestCompleted === guestTotal && guestInProgress === 0;
  }
  const total = guestTotal + checkTotal;
  if (total === 0) return false;
  return (
    guestCompleted === guestTotal &&
    checkCompleted === checkTotal &&
    guestInProgress === 0 &&
    checkInProgress === 0
  );
}
