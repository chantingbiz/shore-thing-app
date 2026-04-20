import { getRouteSheetItemsForWeek } from "../lib/api.js";
import {
  easternSaturdayOnOrBeforeDate,
  serviceDatesForRouteTypeInSheetWeek,
} from "../lib/routeSheetWeek.js";
import {
  isRouteSheetRowIncludedOnActiveSheet,
  isRouteSheetRowSent,
} from "./routeSheetSentGuestCheckSummary.js";

/**
 * @param {string} serviceDateYmd Eastern `YYYY-MM-DD` on the `service_logs` row
 * @returns {{ weekSat: string, routeType: 'turnover'|'midweek' } | null}
 */
export function inferRouteWeekAndTypeFromServiceDate(serviceDateYmd) {
  const d = String(serviceDateYmd ?? "").trim();
  if (!d) return null;
  const weekSat = easternSaturdayOnOrBeforeDate(d);
  const turnoverDays = new Set(serviceDatesForRouteTypeInSheetWeek(weekSat, "turnover"));
  const midweekDays = new Set(serviceDatesForRouteTypeInSheetWeek(weekSat, "midweek"));
  if (turnoverDays.has(d)) return { weekSat, routeType: "turnover" };
  if (midweekDays.has(d)) return { weekSat, routeType: "midweek" };
  return null;
}

/**
 * URL / display anchor: turnover → week Saturday; midweek → that service day.
 *
 * @param {string} serviceDateYmd
 * @param {'turnover'|'midweek'} routeType
 * @param {string} weekSat
 */
export function instanceAnchorYmd(serviceDateYmd, routeType, weekSat) {
  if (routeType === "turnover") return String(weekSat ?? "").trim();
  return String(serviceDateYmd ?? "").trim();
}

/**
 * @param {string} ymd
 */
export function formatSheetInstanceMdYy(ymd) {
  const parts = String(ymd ?? "").split("-");
  if (parts.length !== 3) return String(ymd ?? "");
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const da = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) return String(ymd ?? "");
  const loc = new Date(y, mo - 1, da);
  return loc.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

/**
 * @param {'turnover'|'midweek'} routeType
 * @param {string} anchorYmd
 */
export function formatSheetInstanceLabel(routeType, anchorYmd) {
  const rt = routeType === "turnover" ? "Turnover" : "Midweek";
  return `${rt} — ${formatSheetInstanceMdYy(anchorYmd)}`;
}

/**
 * @param {string} sheetKey `${weekSat}::${routeType}::${techSlug}`
 */
async function propertyIdsOnSentSheet(sheetKey) {
  const parts = sheetKey.split("::");
  if (parts.length < 3) return new Set();
  const weekSat = parts[0];
  const routeType = parts[1];
  const tech = parts.slice(2).join("::");
  if (routeType !== "turnover" && routeType !== "midweek") return new Set();
  const items = await getRouteSheetItemsForWeek(weekSat, routeType, tech);
  const rows = (items ?? []).filter(isRouteSheetRowSent).filter(isRouteSheetRowIncludedOnActiveSheet);
  const set = new Set();
  for (const r of rows) {
    const pid = String(r.property_id ?? "").trim();
    if (pid) set.add(pid);
  }
  return set;
}

/**
 * @param {Iterable<string>} sheetKeys
 * @returns {Promise<Map<string, Set<string>>>}
 */
export async function fetchSheetPropertyIdSets(sheetKeys) {
  const keys = [...new Set(sheetKeys)];
  const entries = await Promise.all(
    keys.map(async (k) => [k, await propertyIdsOnSentSheet(k)])
  );
  return new Map(entries);
}

/**
 * Guest vs check from sent `route_sheet_items` for one sheet instance.
 *
 * @param {string} weekSat
 * @param {'turnover'|'midweek'} routeType
 * @param {string} techSlug
 * @returns {Promise<Map<string, 'guest'|'check'>>} property_id → kind
 */
export async function fetchGuestCheckMapForSheet(weekSat, routeType, techSlug) {
  const slug = String(techSlug ?? "").toLowerCase().trim();
  const m = new Map();
  if (!slug || (routeType !== "turnover" && routeType !== "midweek")) return m;
  const items = await getRouteSheetItemsForWeek(weekSat, routeType, slug);
  const rows = (items ?? []).filter(isRouteSheetRowSent).filter(isRouteSheetRowIncludedOnActiveSheet);
  for (const r of rows) {
    const pid = String(r.property_id ?? "").trim();
    if (!pid) continue;
    m.set(pid, r.guest_check === "guest" ? "guest" : "check");
  }
  return m;
}

/**
 * Groups completed `service_logs` rows into route sheet instances using `route_sheet_items`
 * sent + included membership (same idea as technician route lists).
 *
 * @param {Record<string, unknown>[]} completedLogs
 * @returns {Promise<{ instanceKey: string, techSlug: string, routeType: 'turnover'|'midweek', weekSat: string, anchorYmd: string, label: string, logs: Record<string, unknown>[] }[]>}
 */
export async function groupCompletedLogsIntoRouteInstances(completedLogs) {
  const logs = (completedLogs ?? []).filter((r) => r && r.completed);
  /** @type {{ log: Record<string, unknown>, tech: string, pid: string, weekSat: string, routeType: 'turnover'|'midweek', anchorYmd: string, sheetKey: string }[]} */
  const classified = [];
  const sheetKeys = new Set();

  for (const log of logs) {
    const serviceDate = String(log.service_date ?? "").trim();
    const tech = String(log.technician_slug ?? "").toLowerCase().trim();
    const pid = String(log.property_id ?? "").trim();
    if (!serviceDate || !tech || !pid) continue;
    const inf = inferRouteWeekAndTypeFromServiceDate(serviceDate);
    if (!inf) continue;
    const { weekSat, routeType } = inf;
    const anchorYmd = instanceAnchorYmd(serviceDate, routeType, weekSat);
    const sheetKey = `${weekSat}::${routeType}::${tech}`;
    sheetKeys.add(sheetKey);
    classified.push({
      log,
      tech,
      pid,
      weekSat,
      routeType,
      anchorYmd,
      sheetKey,
    });
  }

  if (!sheetKeys.size) return [];

  const sheetSets = await fetchSheetPropertyIdSets(sheetKeys);

  /** @type {Map<string, { techSlug: string, routeType: 'turnover'|'midweek', weekSat: string, anchorYmd: string, logs: Record<string, unknown>[] }>} */
  const groups = new Map();
  for (const c of classified) {
    const set = sheetSets.get(c.sheetKey);
    if (!set || !set.has(c.pid)) continue;
    const ik = `${c.tech}::${c.routeType}::${c.anchorYmd}`;
    if (!groups.has(ik)) {
      groups.set(ik, {
        techSlug: c.tech,
        routeType: c.routeType,
        weekSat: c.weekSat,
        anchorYmd: c.anchorYmd,
        logs: [],
      });
    }
    groups.get(ik).logs.push(c.log);
  }

  const out = [...groups.values()].map((g) => ({
    instanceKey: `${g.techSlug}::${g.routeType}::${g.anchorYmd}`,
    techSlug: g.techSlug,
    routeType: g.routeType,
    weekSat: g.weekSat,
    anchorYmd: g.anchorYmd,
    label: formatSheetInstanceLabel(g.routeType, g.anchorYmd),
    logs: g.logs,
  }));

  out.sort((a, b) => {
    if (a.anchorYmd !== b.anchorYmd) return a.anchorYmd < b.anchorYmd ? 1 : -1;
    if (a.routeType !== b.routeType) return a.routeType === "turnover" ? -1 : 1;
    return 0;
  });
  return out;
}
