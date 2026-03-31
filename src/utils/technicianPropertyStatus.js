import { getLastInteractionTimestamp } from "./activityLog.js";
import { getLocalDayKey } from "./localDay.js";
import { isPropertyCompletedToday } from "./propertyCompletion.js";
import {
  ensureActivityForToday,
  getActivityEvents,
  getServiceLogRow,
  primePropertiesBySlug,
  resolveDbPropertyId,
} from "../lib/supabaseStore.js";

/**
 * Whether any technician activity was logged today for this property.
 */
export function hasPropertyActivityToday(
  techSlug,
  propertySlug,
  dayKey = getLocalDayKey()
) {
  return (
    getLastInteractionTimestamp(techSlug, propertySlug, dayKey) != null
  );
}

/**
 * For admin UI: completed | in_progress | null (no qualifying activity).
 */
export function getAdminPropertyDayStatus(
  techSlug,
  propertySlug,
  dayKey = getLocalDayKey()
) {
  if (isPropertyCompletedToday(techSlug, propertySlug, dayKey)) {
    return "completed";
  }
  if (hasPropertyActivityToday(techSlug, propertySlug, dayKey)) {
    return "in_progress";
  }
  return null;
}

/**
 * Route-level counts for a technician for the current local day.
 * @param {string} techSlug
 * @param {Array<{ slug: string }>} routeProperties
 * @param {string} [dayKey]
 * @returns {{ total: number, completedCount: number, inProgressCount: number }}
 */
export function getTechnicianRouteDaySummary(
  techSlug,
  routeProperties,
  dayKey = getLocalDayKey()
) {
  const total = routeProperties.length;
  let completedCount = 0;
  let inProgressCount = 0;
  for (const p of routeProperties) {
    const slug = p.slug;
    if (isPropertyCompletedToday(techSlug, slug, dayKey)) {
      completedCount++;
    } else if (hasPropertyActivityToday(techSlug, slug, dayKey)) {
      inProgressCount++;
    }
  }
  return { total, completedCount, inProgressCount };
}

/**
 * Admin summary using property_id-based activity lookup.
 * - completed uses service_logs.completed (via isPropertyCompletedToday which resolves slug->id)
 * - in_progress counts any activity_logs row today for that property_id when not completed
 *
 * @param {string} techSlug
 * @param {Array<{ slug: string }>} routeProperties
 * @param {string} [dayKey]
 */
export function getTechnicianRouteDaySummaryByPropertyId(
  techSlug,
  routeProperties,
  dayKey = getLocalDayKey()
) {
  void dayKey;
  primePropertiesBySlug(routeProperties.map((p) => p.slug));
  void ensureActivityForToday(techSlug);
  const events = getActivityEvents(techSlug);

  const total = routeProperties.length;
  let completedCount = 0;
  let inProgressCount = 0;

  for (const p of routeProperties) {
    const slug = p.slug;
    const id = resolveDbPropertyId(slug);
    if (!id) continue;

    const row = getServiceLogRow(techSlug, id);
    const completed = !!row?.completed || isPropertyCompletedToday(techSlug, slug, dayKey);
    const hasActivity = events.some((e) => e.property_id === id);
    const hasActiveHose = row?.pool_hose_started_at != null || row?.spa_hose_started_at != null;

    if (completed) {
      completedCount++;
      continue;
    }
    if (hasActivity || hasActiveHose) {
      inProgressCount++;
    }
  }

  return { total, completedCount, inProgressCount };
}
