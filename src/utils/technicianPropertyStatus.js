import { getLastInteractionTimestamp } from "./activityLog.js";
import { getLocalDayKey } from "./localDay.js";
import { isPropertyCompletedToday } from "./propertyCompletion.js";

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
