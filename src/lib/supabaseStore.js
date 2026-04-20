import {
  getActivityLogsForToday,
  getPropertiesByIds,
  getPropertiesBySlugs,
  getRouteSettings,
  getServiceLogsForToday,
  logActivity,
  upsertServiceLog,
  updateRouteSettings,
} from "./api.js";
import { supabase } from "./supabaseClient.js";

function makeEmitter() {
  /** @type {Set<() => void>} */
  const listeners = new Set();
  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit() {
      for (const fn of listeners) fn();
    },
  };
}

const emitter = makeEmitter();

/** @type {Map<string, { loadedAt: number, rowsByPropertyId: Map<string, any> }>} */
const serviceLogsByTech = new Map();
/** @type {Map<string, { loadedAt: number, events: any[] }>} */
const activityByTech = new Map();
/** @type {{ loadedAt: number, byPropertyId: Map<string, any> }} */
const routeSettingsCache = { loadedAt: 0, byPropertyId: new Map() };
/** @type {{ loadedAt: number, bySlug: Map<string, any>, byId: Map<string, any> }} */
const propertiesCache = { loadedAt: 0, bySlug: new Map(), byId: new Map() };

/** Basic protection against spamming fetch on rapid changes */
const inflight = new Map();

/** Canonical Map key for `service_logs.property_id` (UUID string). */
function serviceLogPropertyIdKey(propertyId) {
  if (propertyId == null) return "";
  return String(propertyId).trim();
}

export function subscribeToSupabaseChanges() {
  const channel = supabase
    .channel("shore_realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "service_logs" },
      () => {
        const slugs = [...serviceLogsByTech.keys()];
        const toFetch = slugs.length ? slugs : ["stephen"];
        for (const techSlug of toFetch) {
          void ensureServiceLogsForToday(techSlug);
        }
        emitter.emit();
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "activity_logs" },
      () => {
        emitter.emit();
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "route_settings" },
      () => {
        emitter.emit();
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "route_sheet_items" },
      () => {
        emitter.emit();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function onSupabaseDataChanged(fn) {
  return emitter.subscribe(fn);
}

async function deduped(key, fn) {
  const prev = inflight.get(key);
  if (prev) return prev;
  const p = (async () => {
    try {
      return await fn();
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export function primeTechnicianToday(techSlug, routePropertyIds = []) {
  if (!techSlug) return;
  void ensureServiceLogsForToday(techSlug);
  void ensureActivityForToday(techSlug);
  if (routePropertyIds.length) void ensureRouteSettings(routePropertyIds);
}

export function primePropertiesBySlug(propertySlugs = []) {
  void ensurePropertiesBySlug(propertySlugs);
}

export async function ensurePropertiesBySlug(propertySlugs) {
  const slugs = (propertySlugs ?? []).filter(Boolean);
  if (!slugs.length) return;
  const key = `properties:${slugs.slice().sort().join(",")}`;
  return deduped(key, async () => {
    const rows = await getPropertiesBySlugs(slugs);
    for (const r of rows) {
      if (r?.property_slug && r?.id) {
        propertiesCache.bySlug.set(String(r.property_slug).toLowerCase(), r);
        propertiesCache.byId.set(String(r.id), r);
      }
    }
    propertiesCache.loadedAt = Date.now();
    emitter.emit();
  });
}

export function resolveDbPropertyId(propertySlug) {
  if (!propertySlug) return null;
  return propertiesCache.bySlug.get(String(propertySlug).toLowerCase())?.id ?? null;
}

export function getPropertyById(propertyId) {
  if (!propertyId) return null;
  return propertiesCache.byId.get(String(propertyId)) ?? null;
}

export async function ensurePropertiesById(propertyIds) {
  const ids = (propertyIds ?? []).filter(Boolean);
  if (!ids.length) return;
  const key = `propertiesById:${ids.slice().sort().join(",")}`;
  return deduped(key, async () => {
    const rows = await getPropertiesByIds(ids);
    for (const r of rows) {
      if (r?.id) {
        propertiesCache.byId.set(String(r.id), r);
        if (r?.property_slug) {
          propertiesCache.bySlug.set(String(r.property_slug).toLowerCase(), r);
        }
      }
    }
    propertiesCache.loadedAt = Date.now();
    emitter.emit();
  });
}

export async function ensureServiceLogsForToday(techSlug) {
  if (!techSlug) return;
  return deduped(`service:${techSlug}`, async () => {
    const rows = await getServiceLogsForToday(techSlug);
    const prev = serviceLogsByTech.get(techSlug)?.rowsByPropertyId ?? new Map();
    const next = new Map(prev);
    for (const r of rows) {
      if (!r?.property_id) continue;
      const key = serviceLogPropertyIdKey(r.property_id);
      if (!key) continue;
      next.set(key, r);
    }
    serviceLogsByTech.set(techSlug, { loadedAt: Date.now(), rowsByPropertyId: next });
    emitter.emit();
  });
}

export async function ensureActivityForToday(techSlug) {
  if (!techSlug) return;
  return deduped(`activity:${techSlug}`, async () => {
    const events = await getActivityLogsForToday(techSlug);
    activityByTech.set(techSlug, { loadedAt: Date.now(), events });
    emitter.emit();
  });
}

export async function ensureRouteSettings(propertyIds) {
  const ids = (propertyIds ?? []).filter(Boolean);
  if (!ids.length) return;
  const key = `route:${ids.slice().sort().join(",")}`;
  return deduped(key, async () => {
    const rows = await getRouteSettings(ids);
    for (const r of rows) {
      routeSettingsCache.byPropertyId.set(r.property_id, r);
    }
    routeSettingsCache.loadedAt = Date.now();
    emitter.emit();
  });
}

export function getServiceLogRow(techSlug, propertyId) {
  const key = serviceLogPropertyIdKey(propertyId);
  if (!key) return null;
  return serviceLogsByTech.get(techSlug)?.rowsByPropertyId.get(key) ?? null;
}

export function getActivityEvents(techSlug) {
  return activityByTech.get(techSlug)?.events ?? [];
}

export function getRouteSettingsRow(propertyId) {
  return routeSettingsCache.byPropertyId.get(propertyId) ?? null;
}

export async function patchServiceLog(techSlug, propertyId, patch) {
  const idKey = serviceLogPropertyIdKey(propertyId);
  if (!techSlug || !idKey) return { ok: false };

  // optimistic cache update
  const prev = getServiceLogRow(techSlug, idKey) ?? {
    property_id: idKey,
    technician_slug: techSlug,
  };
  const next = { ...prev, ...patch };
  const block = serviceLogsByTech.get(techSlug) ?? {
    loadedAt: 0,
    rowsByPropertyId: new Map(),
  };
  block.rowsByPropertyId.set(idKey, next);
  serviceLogsByTech.set(techSlug, block);
  emitter.emit();

  try {
    const saved = await upsertServiceLog(idKey, techSlug, patch);
    block.rowsByPropertyId.set(idKey, saved ?? next);
    serviceLogsByTech.set(techSlug, block);
    emitter.emit();
    return { ok: true, data: saved ?? next };
  } catch (e) {
    console.error("patchServiceLog failed:", e);
    return { ok: false, error: e };
  }
}

export async function insertActivity(techSlug, propertyId, eventType, eventLabel) {
  if (!techSlug || !propertyId || !eventType) return;
  try {
    await logActivity(techSlug, propertyId, eventType, eventLabel ?? eventType);
  } catch (error) {
    console.error("Supabase write failed", error);
  }
  // Prefer refetch via realtime; but also nudge UI
  emitter.emit();
}

export async function patchRouteSettings(propertyId, settings) {
  if (!propertyId) return;
  const prev = routeSettingsCache.byPropertyId.get(propertyId) ?? {
    property_id: propertyId,
  };
  routeSettingsCache.byPropertyId.set(propertyId, { ...prev, ...settings });
  routeSettingsCache.loadedAt = Date.now();
  emitter.emit();

  try {
    const saved = await updateRouteSettings(propertyId, settings);
    routeSettingsCache.byPropertyId.set(propertyId, saved ?? { ...prev, ...settings });
    routeSettingsCache.loadedAt = Date.now();
    emitter.emit();
  } catch (error) {
    console.error("Supabase write failed", error);
  }
}

export function resetSupabaseCaches() {
  serviceLogsByTech.clear();
  activityByTech.clear();
  routeSettingsCache.byPropertyId.clear();
  routeSettingsCache.loadedAt = 0;
  propertiesCache.byId.clear();
  propertiesCache.bySlug.clear();
  propertiesCache.loadedAt = 0;
  inflight.clear();
  emitter.emit();
}

