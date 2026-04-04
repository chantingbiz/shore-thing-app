import { getStephenPropertyBySlug } from "../data/stephenProperties.js";
import {
  ensureActivityForToday,
  ensurePropertiesById,
  getActivityEvents,
  getPropertyById,
  insertActivity,
  primePropertiesBySlug,
  resolveDbPropertyId,
} from "../lib/supabaseStore.js";
import { getLocalDayKey } from "./localDay.js";
import { isPropertyCompletedToday } from "./propertyCompletion.js";

export { getLocalDayKey } from "./localDay.js";

/** Events within this span (same property + category) collapse to one admin line. */
export const ACTIVITY_GROUP_WINDOW_MS = 90_000;

/**
 * @param {string} techSlug
 * @param {{ propertySlug: string, propertyName: string, type: string, label?: string }} payload
 */
export function logTechnicianActivity(techSlug, payload) {
  if (!techSlug || !payload?.propertySlug) return;
  const prop =
    techSlug === "stephen" ? getStephenPropertyBySlug(payload.propertySlug) : null;
  if (!prop?.slug) return;
  primePropertiesBySlug([prop.slug]);
  const resolved = resolveDbPropertyId(prop.slug);
  console.log("Supabase write preflight", {
    property_slug: prop.slug,
    property_id: resolved,
    event_type: payload.type,
  });
  if (!resolved) return;
  void insertActivity(techSlug, resolved, payload.type, payload.label || payload.type);
}

export function getTechnicianDayBlock(techSlug, dayKey = getLocalDayKey()) {
  void dayKey;
  void ensureActivityForToday(techSlug);
  const raw = getActivityEvents(techSlug);
  if (!raw.length) return null;

  // ensure we have names for the properties referenced by activity logs
  void ensurePropertiesById(raw.map((r) => r.property_id));

  const mapped = raw
    .map((r) => {
      const prop = getPropertyById(r.property_id);
      return {
        t: Date.parse(r.created_at),
        // Keep the existing UI shape (propertySlug used for grouping/links).
        // For admin routes, we still link using a slug when available.
        propertySlug: prop?.property_slug ?? String(r.property_id),
        propertyName: prop?.name ?? "Property",
        type: r.event_type,
        label: r.event_label ?? r.event_type,
        propertyId: r.property_id,
        propertyAddress: prop?.address ?? null,
      };
    })
    .filter((e) => Number.isFinite(e.t));
  if (!mapped.length) return null;
  const firstAt = mapped.reduce((min, e) => (min == null ? e.t : Math.min(min, e.t)), null);
  return { firstAt, events: mapped };
}

export function getFirstActivityTimestampToday(techSlug) {
  const block = getTechnicianDayBlock(techSlug);
  return block?.firstAt ?? null;
}

export function getTechnicianEventsToday(techSlug) {
  const block = getTechnicianDayBlock(techSlug);
  return block?.events ? [...block.events] : [];
}

export function getTechnicianEventsForDay(techSlug, dayKey) {
  const block = getTechnicianDayBlock(techSlug, dayKey);
  return block?.events ? [...block.events] : [];
}

/**
 * Latest activity timestamp for a property today (any event type).
 * @param {string} techSlug
 * @param {string} propertySlug
 * @param {string} [dayKey]
 * @returns {number | null}
 */
export function getLastInteractionTimestamp(
  techSlug,
  propertySlug,
  dayKey = getLocalDayKey()
) {
  const events = getTechnicianEventsForDay(techSlug, dayKey);
  let max = null;
  for (const ev of events) {
    if (ev.propertySlug === propertySlug) {
      if (max == null || ev.t > max) max = ev.t;
    }
  }
  return max;
}

function mapEventTypeToDisplayLabel(ev) {
  switch (ev.type) {
    case "pool_hose_started":
      return "Dropped pool hose";
    case "pool_hose_stopped":
      return "Removed pool hose";
    case "spa_hose_started":
      return "Dropped spa hose";
    case "spa_hose_stopped":
      return "Removed spa hose";
    case "property_completed":
      return "Completed property";
    case "pool_reading_updated":
      return "Updated pool readings";
    case "spa_reading_updated":
      return "Updated spa readings";
    case "reading_updated":
      return "Updated readings";
    case "pool_chemical_updated":
      return "Adjusted pool chemicals";
    case "spa_chemical_updated":
      return "Adjusted spa chemicals";
    case "chemical_updated":
      return "Adjusted chemicals";
    case "pool_before_photo_added":
      return "Added pool before photo";
    case "pool_after_photo_added":
      return "Added pool after photo";
    case "spa_before_photo_added":
      return "Added spa before photo";
    case "spa_after_photo_added":
      return "Added spa after photo";
    default:
      return ev.label || ev.type;
  }
}

/** Adjacent events merge only when same property, window, and this category key. */
function activityGroupCategory(type) {
  switch (type) {
    case "pool_reading_updated":
      return "pool_reading";
    case "spa_reading_updated":
      return "spa_reading";
    case "reading_updated":
      return "reading";
    case "pool_chemical_updated":
      return "pool_chemical";
    case "spa_chemical_updated":
      return "spa_chemical";
    case "chemical_updated":
      return "chemical";
    default:
      return null;
  }
}

/**
 * Raw events → grouped rows for admin (readings/chemicals merged within window per property).
 * Newest-first. Each item has `displayLabel` and `t` (anchor time for the group).
 *
 * @param {Array<{ t: number, propertySlug: string, propertyName: string, type: string, label?: string }>} events
 * @param {number} [windowMs]
 * @returns {Array<{ t: number, propertySlug: string, propertyName: string, type: string, displayLabel: string }>}
 */
export function getGroupedDisplayEvents(
  events,
  windowMs = ACTIVITY_GROUP_WINDOW_MS
) {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const out = [];
  let i = 0;
  while (i < sorted.length) {
    const ev = sorted[i];
    const cat = activityGroupCategory(ev.type);
    if (cat == null) {
      out.push({
        t: ev.t,
        propertySlug: ev.propertySlug,
        propertyName: ev.propertyName,
        type: ev.type,
        displayLabel: mapEventTypeToDisplayLabel(ev),
      });
      i++;
      continue;
    }
    const prop = ev.propertySlug;
    const startT = ev.t;
    let j = i + 1;
    while (j < sorted.length) {
      const next = sorted[j];
      const nextCat = activityGroupCategory(next.type);
      if (nextCat !== cat || next.propertySlug !== prop) break;
      if (next.t - startT > windowMs) break;
      j++;
    }
    const displayLabel =
      sorted[i].label || mapEventTypeToDisplayLabel(sorted[i]);
    const isReadingGroup =
      cat === "pool_reading" ||
      cat === "spa_reading" ||
      cat === "reading";
    out.push({
      t: sorted[i].t,
      propertySlug: prop,
      propertyName: sorted[i].propertyName,
      type: isReadingGroup ? "reading_group" : "chemical_group",
      displayLabel,
    });
    i = j;
  }
  return out.sort((a, b) => b.t - a.t);
}

export function getPropertiesTouchedToday(techSlug) {
  const events = getTechnicianEventsToday(techSlug);
  const map = new Map();
  for (const ev of events) {
    let row = map.get(ev.propertySlug);
    if (!row) {
      row = {
        propertySlug: ev.propertySlug,
        propertyName: ev.propertyName,
        lastT: ev.t,
        types: new Set(),
      };
      map.set(ev.propertySlug, row);
    }
    row.lastT = Math.max(row.lastT, ev.t);
    row.propertyName = ev.propertyName;
    row.types.add(ev.type);
  }

  const grouped = getGroupedDisplayEvents(events);
  const summaryByProp = new Map();
  for (const g of grouped) {
    const prev = summaryByProp.get(g.propertySlug) || [];
    prev.push(g.displayLabel);
    summaryByProp.set(g.propertySlug, prev);
  }

  return [...map.values()]
    .sort((a, b) => b.lastT - a.lastT)
    .map((r) => {
      const completed = isPropertyCompletedToday(techSlug, r.propertySlug);
      const unique = [...new Set(summaryByProp.get(r.propertySlug) || [])];
      return {
        propertySlug: r.propertySlug,
        propertyName: r.propertyName,
        lastT: r.lastT,
        summary: unique.length ? unique.join(" · ") : "Activity",
        completed,
      };
    });
}

export function formatActivityTime(ts) {
  if (ts == null) return "";
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
