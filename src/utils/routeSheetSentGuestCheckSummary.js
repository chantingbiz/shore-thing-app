import { getRouteSheetItemsForWeek } from "../lib/api.js";
import { getActiveRouteSheetSaturdayEastern } from "../lib/routeSheetWeek.js";
import {
  ensurePropertiesById,
  ensureServiceLogsForToday,
  getPropertyById,
} from "../lib/supabaseStore.js";
import { getLocalDayKey } from "./localDay.js";
import { isPropertyCompletedToday } from "./propertyCompletion.js";

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
 * Guest/check totals from sent `route_sheet_items` for the week; completed counts use
 * `isPropertyCompletedToday` after resolving `property_id` → slug via the properties cache.
 *
 * Count rules:
 * - **Turnover:** sent rows with `included` on active sheet; split by `guest_check`.
 * - **Midweek:** same sent + included filter, but only **guest** rows count toward workload;
 *   check totals are always 0 (revisit sheet is guest-only in summaries).
 *
 * @param {string} technicianSlug
 * @param {'turnover'|'midweek'} routeType
 * @param {{ weekStartDate?: string, dayKey?: string }} [opts]
 * @returns {Promise<{ guestTotal: number, guestCompleted: number, checkTotal: number, checkCompleted: number, weekStartDate: string, midweekGuestsOnly: boolean }>}
 */
export async function fetchRouteSheetSentGuestCheckSummary(
  technicianSlug,
  routeType,
  opts = {}
) {
  const slug = String(technicianSlug ?? "").toLowerCase().trim();
  const weekStartDate =
    String(opts.weekStartDate ?? "").trim() || getActiveRouteSheetSaturdayEastern();
  const dayKey = opts.dayKey ?? getLocalDayKey();
  const midweekGuestsOnly = routeType === "midweek";

  if (!slug || (routeType !== "turnover" && routeType !== "midweek")) {
    return {
      guestTotal: 0,
      guestCompleted: 0,
      checkTotal: 0,
      checkCompleted: 0,
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

  let guestTotal = 0;
  let guestCompleted = 0;
  let checkTotal = 0;
  let checkCompleted = 0;

  for (const row of workloadRows) {
    const isGuest = row.guest_check === "guest";
    if (isGuest) guestTotal += 1;
    else checkTotal += 1;

    const pid = String(row.property_id ?? "").trim();
    const prop = pid ? getPropertyById(pid) : null;
    const pslug = String(prop?.property_slug ?? "").trim();
    const done = pslug ? isPropertyCompletedToday(slug, pslug, dayKey) : false;
    if (isGuest) {
      if (done) guestCompleted += 1;
    } else {
      if (done) checkCompleted += 1;
    }
  }

  if (import.meta.env.DEV) {
    console.log("[route sheet sent counts]", {
      week_start_date: weekStartDate,
      technician_slug: slug,
      route_type: routeType,
      rows_loaded: items?.length ?? 0,
      sent_rows: sent.length,
      included_rows: active.length,
      workload_rows: workloadRows.length,
      midweek_guests_only: midweekGuestsOnly,
      guest: `${guestCompleted}/${guestTotal}`,
      check: `${checkCompleted}/${checkTotal}`,
    });
  }

  if (midweekGuestsOnly) {
    return {
      guestTotal,
      guestCompleted,
      checkTotal: 0,
      checkCompleted: 0,
      weekStartDate,
      midweekGuestsOnly: true,
    };
  }

  return {
    guestTotal,
    guestCompleted,
    checkTotal,
    checkCompleted,
    weekStartDate,
    midweekGuestsOnly: false,
  };
}
