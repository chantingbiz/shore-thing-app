import { isTechnicianRouteTypeSegment } from "../data/technicianRouteSheetsMock.js";

/**
 * @param {string} pathname
 * @returns {'turnover' | 'midweek' | null}
 */
export function getRouteTypeFromTechnicianPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "technician" || parts.length < 3) return null;
  const seg = parts[2];
  return isTechnicianRouteTypeSegment(seg) ? seg : null;
}

/** List view for a technician + route type (Turnover / Midweek sheet context). */
export function technicianRouteListPath(technicianSlug, routeType) {
  return `/technician/${technicianSlug}/${routeType}`;
}

/** Property detail within a route-type sheet. */
export function technicianPropertyDetailPath(technicianSlug, routeType, propertySlug) {
  return `/technician/${technicianSlug}/${routeType}/${propertySlug}`;
}
