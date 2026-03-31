import { getLastInteractionTimestamp } from "./activityLog.js";
import { getLocalDayKey } from "./localDay.js";
import { getPoolStart, getSpaStart } from "./hoseTimers.js";
import { isPropertyCompletedToday } from "./propertyCompletion.js";

/**
 * Sort tier (lower = higher on screen): active hoses → worked today → untouched → completed.
 * @param {string} techSlug
 * @param {string} propertySlug
 * @param {string} dayKey
 */
export function getTechnicianPropertySortTier(techSlug, propertySlug, dayKey) {
  if (isPropertyCompletedToday(techSlug, propertySlug, dayKey)) return 3;
  const active =
    getPoolStart(propertySlug) != null || getSpaStart(propertySlug) != null;
  if (active) return 0;
  const last = getLastInteractionTimestamp(techSlug, propertySlug, dayKey);
  if (last != null) return 1;
  return 2;
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
    const ta = getTechnicianPropertySortTier(techSlug, a.slug, dayKey);
    const tb = getTechnicianPropertySortTier(techSlug, b.slug, dayKey);
    if (ta !== tb) return ta - tb;
    if (ta === 2) {
      return (index.get(a.slug) ?? 0) - (index.get(b.slug) ?? 0);
    }
    const la = getLastInteractionTimestamp(techSlug, a.slug, dayKey) ?? 0;
    const lb = getLastInteractionTimestamp(techSlug, b.slug, dayKey) ?? 0;
    return lb - la;
  });
}
