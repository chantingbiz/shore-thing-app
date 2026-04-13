import { getLocalDayKey } from "./localDay.js";
import { isPropertyCompletedToday } from "./propertyCompletion.js";
import {
  getMockRouteSlugsForType,
  getStephenServiceKindForSlug,
} from "../data/technicianRouteSheetsMock.js";

/**
 * Guest vs check completion counts for one technician route sheet (Turnover or Midweek).
 * Stephen: uses mock slug sets + static service kind map + live completion state.
 * Other technicians: mock returns no slugs → 0/0 until Supabase turnover/midweek lists exist.
 *
 * @param {string} technicianSlug
 * @param {import('../data/technicianRouteSheetsMock.js').TechnicianRouteType} routeType
 * @param {string} [dayKey]
 */
export function getGuestCheckSummaryForRouteType(technicianSlug, routeType, dayKey = getLocalDayKey()) {
  const slugs = getMockRouteSlugsForType(technicianSlug, routeType);
  let guestTotal = 0;
  let guestCompleted = 0;
  let checkTotal = 0;
  let checkCompleted = 0;

  for (const slug of slugs) {
    const kind = getStephenServiceKindForSlug(slug);
    const done = isPropertyCompletedToday(technicianSlug, slug, dayKey);
    if (kind === "guest") {
      guestTotal += 1;
      if (done) guestCompleted += 1;
    } else {
      checkTotal += 1;
      if (done) checkCompleted += 1;
    }
  }

  return { guestTotal, guestCompleted, checkTotal, checkCompleted };
}
