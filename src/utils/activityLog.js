import { getStephenPropertyById, getStephenPropertyBySlug } from "../data/stephenProperties.js";
import {
  ensureActivityForToday,
  getActivityEvents,
  insertActivity,
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
  if (!prop?.id) return;
  void insertActivity(techSlug, prop.id, payload.type);
}

export function getTechnicianDayBlock(techSlug, dayKey = getLocalDayKey()) {
  void dayKey;
  void ensureActivityForToday(techSlug);
  const raw = getActivityEvents(techSlug);
  if (!raw.length) return null;
  const mapped = raw
    .map((r) => {
      const prop = techSlug === "stephen" ? getStephenPropertyById(r.property_id) : null;
      return {
        t: Date.parse(r.created_at),
        propertySlug: prop?.slug ?? String(r.property_id),
        propertyName: prop?.name ?? "Property",
        type: r.action_type,
        label: r.action_type,
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
    case "reading_updated":
      return "Updated readings";
    case "chemical_updated":
      return "Adjusted chemicals";
    default:
      return ev.label || ev.type;
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
    const cat =
      ev.type === "reading_updated"
        ? "reading"
        : ev.type === "chemical_updated"
          ? "chemical"
          : null;
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
      const nextCat =
        next.type === "reading_updated"
          ? "reading"
          : next.type === "chemical_updated"
            ? "chemical"
            : null;
      if (nextCat !== cat || next.propertySlug !== prop) break;
      if (next.t - startT > windowMs) break;
      j++;
    }
    const displayLabel =
      cat === "reading" ? "Updated readings" : "Adjusted chemicals";
    out.push({
      t: sorted[i].t,
      propertySlug: prop,
      propertyName: sorted[i].propertyName,
      type: cat === "reading" ? "reading_group" : "chemical_group",
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
