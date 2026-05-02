import { getStephenPropertyBySlug } from "../data/stephenProperties.js";
import { getServiceLogsForTechnicianPropertiesDateRange } from "../lib/api.js";
import {
  getServiceLogRow,
  insertActivity,
  patchServiceLog,
  primePropertiesBySlug,
  resolveDbPropertyId,
} from "../lib/supabaseStore.js";
import { getTodayEasternDate } from "../lib/easternDate.js";
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
 * @param {{ serviceDateYmd?: string }} [opts] Eastern `YYYY-MM-DD` row to patch (route-sheet early work).
 */
export async function setPropertyCompletedForDay(
  techSlug,
  propertySlug,
  completed,
  dayKey = getLocalDayKey(),
  opts = {}
) {
  void dayKey;
  if (!techSlug || !propertySlug) return;
  const slug = completionPropertySlug(techSlug, propertySlug);
  if (!slug) return;
  primePropertiesBySlug([slug]);
  const resolved = resolveDbPropertyId(slug);
  const serviceDate = String(opts.serviceDateYmd ?? "").trim() || getTodayEasternDate();
  console.log("Supabase write preflight", {
    property_slug: slug,
    property_id: resolved,
    service_date: serviceDate,
    onConflict: "property_id,service_date",
  });
  if (!resolved) return;
  const nowIso = new Date().toISOString();
  /** @type {Record<string, unknown>} */
  const patch = {
    completed: !!completed,
    completed_at: completed ? nowIso : null,
  };

  if (completed) {
    try {
      const rows = await getServiceLogsForTechnicianPropertiesDateRange(
        techSlug.toLowerCase(),
        [resolved],
        serviceDate,
        serviceDate
      );
      const rowOne = rows[0];
      if (rowOne?.pool_hose_started_at != null) {
        patch.pool_hose_started_at = null;
        void insertActivity(techSlug, resolved, "pool_hose_stopped", "Removed pool hose");
      }
      if (rowOne?.spa_hose_started_at != null) {
        patch.spa_hose_started_at = null;
        void insertActivity(techSlug, resolved, "spa_hose_stopped", "Removed spa hose");
      }
    } catch (e) {
      console.error("[setPropertyCompletedForDay] could not preload hose timestamps", e);
    }
  }

  await patchServiceLog(techSlug, resolved, patch, serviceDate);
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
