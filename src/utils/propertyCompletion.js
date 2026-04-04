import { getStephenPropertyBySlug } from "../data/stephenProperties.js";
import {
  getServiceLogRow,
  insertActivity,
  patchServiceLog,
  primePropertiesBySlug,
  resolveDbPropertyId,
} from "../lib/supabaseStore.js";
import { getLocalDayKey } from "./localDay.js";

/**
 * Resolve list/card property slug: Stephen static seed entries use canonical slug from data;
 * all other technicians (and DB-only Stephen rows) use the slug as-is.
 * @param {string} techSlug
 * @param {string} propertySlug
 */
function completionPropertySlug(techSlug, propertySlug) {
  if (!propertySlug) return "";
  if (techSlug === "stephen") {
    const s = getStephenPropertyBySlug(propertySlug);
    if (s?.slug) return s.slug;
  }
  return propertySlug;
}

/**
 * @param {string} techSlug
 * @param {string} propertySlug
 * @param {boolean} completed
 * @param {string} [dayKey]
 */
export function setPropertyCompletedForDay(
  techSlug,
  propertySlug,
  completed,
  dayKey = getLocalDayKey()
) {
  void dayKey;
  if (!techSlug || !propertySlug) return;
  const slug = completionPropertySlug(techSlug, propertySlug);
  if (!slug) return;
  primePropertiesBySlug([slug]);
  const resolved = resolveDbPropertyId(slug);
  console.log("Supabase write preflight", {
    property_slug: slug,
    property_id: resolved,
    service_date: getLocalDayKey(),
    onConflict: "property_id,service_date",
  });
  if (!resolved) return;
  const nowIso = new Date().toISOString();
  const row = getServiceLogRow(techSlug, resolved);
  const patch = {
    completed: !!completed,
    completed_at: completed ? nowIso : null,
  };
  if (completed) {
    if (row?.pool_hose_started_at != null) {
      patch.pool_hose_started_at = null;
      void insertActivity(techSlug, resolved, "pool_hose_stopped", "Removed pool hose");
    }
    if (row?.spa_hose_started_at != null) {
      patch.spa_hose_started_at = null;
      void insertActivity(techSlug, resolved, "spa_hose_stopped", "Removed spa hose");
    }
  }
  void patchServiceLog(techSlug, resolved, patch);
}

export function isPropertyCompletedToday(
  techSlug,
  propertySlug,
  dayKey = getLocalDayKey()
) {
  void dayKey;
  if (!techSlug || !propertySlug) return false;
  const slug = completionPropertySlug(techSlug, propertySlug);
  if (!slug) return false;
  const id = resolveDbPropertyId(slug);
  if (!id) return false;
  const row = getServiceLogRow(techSlug, id);
  return !!row?.completed;
}

export function getPropertyCompletedAt(
  techSlug,
  propertySlug,
  dayKey = getLocalDayKey()
) {
  void dayKey;
  if (!techSlug || !propertySlug) return null;
  const slug = completionPropertySlug(techSlug, propertySlug);
  if (!slug) return null;
  const id = resolveDbPropertyId(slug);
  if (!id) return null;
  const row = getServiceLogRow(techSlug, id);
  const t = row?.completed_at ? Date.parse(row.completed_at) : null;
  return Number.isFinite(t) ? t : null;
}
