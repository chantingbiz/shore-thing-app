/**
 * Temporary mock: which property slugs belong to Turnover vs Midweek for each technician.
 *
 * IMPORTANT — Future wiring:
 * These lists will be replaced by separate Supabase-backed route assignments per technician,
 * populated from the admin route sheet dashboard when Turnover / Midweek sheets are built and sent.
 * Do not assume a single combined "route" query; turnoverProperties and midweekProperties will be
 * independent datasets (different sheets / service contexts).
 *
 * @typedef {'turnover' | 'midweek'} TechnicianRouteType
 */

/** @type {TechnicianRouteType[]} */
export const TECHNICIAN_ROUTE_TYPES = ["turnover", "midweek"];

/**
 * @param {string} segment
 * @returns {segment is TechnicianRouteType}
 */
export function isTechnicianRouteTypeSegment(segment) {
  return segment === "turnover" || segment === "midweek";
}

/**
 * Guest vs check — used for completion summaries and future filtering.
 * Keys: Stephen property slugs (static seed).
 *
 * @type {Record<string, 'guest' | 'check'>}
 */
export const STEPHEN_PROPERTY_SERVICE_KIND_BY_SLUG = {
  "just-one-more-day-key": "check",
  "jamaican-me-happy": "check",
  "eels-in-the-sand": "check",
  "cape-winds-key": "check",
  "its-sunbelievable": "check",
  "atlantic-dreams": "check",
  "whale-kept-secret": "guest",
  "caribbean-wave": "guest",
  "dolphin-view-hideaway": "guest",
  "blue-ocean-views": "guest",
  "caribbean-paradise": "guest",
  "a-wave-from-it-all": "guest",
};

/**
 * Mock slug sets per route type (Stephen). Split is intentional placeholder data.
 * @type {Record<string, Record<TechnicianRouteType, string[]>>}
 */
export const MOCK_ROUTE_SLUGS_BY_TECH_AND_TYPE = {
  stephen: {
    turnover: [
      "just-one-more-day-key",
      "jamaican-me-happy",
      "eels-in-the-sand",
      "whale-kept-secret",
      "caribbean-wave",
      "dolphin-view-hideaway",
    ],
    midweek: [
      "cape-winds-key",
      "its-sunbelievable",
      "blue-ocean-views",
      "caribbean-paradise",
      "atlantic-dreams",
      "a-wave-from-it-all",
    ],
  },
};

/**
 * Property slugs assigned to a route type for this technician (mock).
 * Future: fetch `turnoverSlugs` / `midweekSlugs` (or full rows) from Supabase separately.
 *
 * @param {string} technicianSlug
 * @param {TechnicianRouteType} routeType
 * @returns {string[]}
 */
export function getMockRouteSlugsForType(technicianSlug, routeType) {
  const key = (technicianSlug ?? "").toLowerCase();
  const row = MOCK_ROUTE_SLUGS_BY_TECH_AND_TYPE[key];
  if (!row) return [];
  return row[routeType] ?? [];
}

/**
 * @param {string} propertySlug
 * @returns {'guest' | 'check'}
 */
export function getStephenServiceKindForSlug(propertySlug) {
  const k = (propertySlug ?? "").toLowerCase();
  return STEPHEN_PROPERTY_SERVICE_KIND_BY_SLUG[k] ?? "guest";
}
