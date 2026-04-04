import { getGuestCheckMode } from "./adminRouteStorage.js";
import { getLastInteractionTimestamp } from "./activityLog.js";
import { getLocalDayKey } from "./localDay.js";
import { isPropertyCompletedToday } from "./propertyCompletion.js";
import { hasPropertyActivityToday } from "./technicianPropertyStatus.js";

/**
 * Sort rank (lower = higher on screen). Completed always last (4).
 * Among uncompleted: guest routes before check; within each, active (activity today) before not.
 *
 * 0 = active + uncompleted + guest (or unset → guest)
 * 1 = uncompleted + guest + not active
 * 2 = active + uncompleted + check
 * 3 = uncompleted + check + not active
 * 4 = completed
 *
 * @param {string} techSlug
 * @param {string} propertySlug
 * @param {string} dayKey
 */
function getTechnicianPropertySortRank(techSlug, propertySlug, dayKey) {
  if (isPropertyCompletedToday(techSlug, propertySlug, dayKey)) return 4;
  const active = hasPropertyActivityToday(techSlug, propertySlug, dayKey);
  const isGuestRoute = getGuestCheckMode(propertySlug) !== "check";
  if (isGuestRoute && active) return 0;
  if (isGuestRoute && !active) return 1;
  if (!isGuestRoute && active) return 2;
  return 3;
}

/**
 * @template {{ slug: string }} T
 * @param {T[]} properties
 * @param {string} techSlug
 * @param {string} [dayKey]
 * @returns {T[]}
 */
export function sortPropertiesForTechnicianList(
  properties,
  techSlug,
  dayKey = getLocalDayKey()
) {
  const index = new Map(properties.map((p, i) => [p.slug, i]));
  return [...properties].sort((a, b) => {
    const ra = getTechnicianPropertySortRank(techSlug, a.slug, dayKey);
    const rb = getTechnicianPropertySortRank(techSlug, b.slug, dayKey);
    if (ra !== rb) return ra - rb;
    if (ra === 0 || ra === 2) {
      const la = getLastInteractionTimestamp(techSlug, a.slug, dayKey) ?? 0;
      const lb = getLastInteractionTimestamp(techSlug, b.slug, dayKey) ?? 0;
      return lb - la;
    }
    return (index.get(a.slug) ?? 0) - (index.get(b.slug) ?? 0);
  });
}
