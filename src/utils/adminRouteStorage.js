export function guestCheckKey(propertySlug) {
  return `admin_route_guest_check_${propertySlug}`;
}

export function poolHeatKey(propertySlug) {
  return `admin_route_pool_heat_${propertySlug}`;
}

/** @returns {'guest'|'check'|null} */
export function getGuestCheckMode(propertySlug) {
  try {
    const v = localStorage.getItem(guestCheckKey(propertySlug));
    if (v === "guest" || v === "check") return v;
    return null;
  } catch {
    return null;
  }
}

export function setGuestCheckMode(propertySlug, mode) {
  try {
    if (mode == null) localStorage.removeItem(guestCheckKey(propertySlug));
    else localStorage.setItem(guestCheckKey(propertySlug), mode);
  } catch {
    /* ignore */
  }
}

/** @returns {'heat'|'no_heat'|null} */
export function getPoolHeatMode(propertySlug) {
  try {
    const v = localStorage.getItem(poolHeatKey(propertySlug));
    if (v === "heat" || v === "no_heat") return v;
    return null;
  } catch {
    return null;
  }
}

export function setPoolHeatMode(propertySlug, mode) {
  try {
    if (mode == null) localStorage.removeItem(poolHeatKey(propertySlug));
    else localStorage.setItem(poolHeatKey(propertySlug), mode);
  } catch {
    /* ignore */
  }
}

/** Display label for technician UI (matches admin segmented defaults when unset). */
export function getGuestCheckLabel(propertySlug) {
  return getGuestCheckMode(propertySlug) === "check" ? "Check" : "Guest";
}

/** Display label for technician UI (matches admin segmented defaults when unset). */
export function getPoolHeatLabel(propertySlug) {
  return getPoolHeatMode(propertySlug) === "no_heat" ? "No Pool Heat" : "Pool Heat";
}
