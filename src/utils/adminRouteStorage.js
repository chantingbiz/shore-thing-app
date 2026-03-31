import {
  getRouteSettingsRow,
  patchRouteSettings,
  primePropertiesBySlug,
  resolveDbPropertyId,
} from "../lib/supabaseStore.js";

/** @returns {'guest'|'check'|null} */
export function getGuestCheckMode(propertyId) {
  const id = resolveDbPropertyId(propertyId);
  const row = id ? getRouteSettingsRow(id) : null;
  const v = row?.guest_check;
  return v === "guest" || v === "check" ? v : null;
}

export function setGuestCheckMode(propertyId, mode) {
  primePropertiesBySlug([propertyId]);
  const resolved = resolveDbPropertyId(propertyId);
  console.log("Supabase write preflight", {
    property_slug: propertyId,
    property_id: resolved,
    onConflict: "property_id",
  });
  if (!resolved) return;
  const v = mode === "guest" || mode === "check" ? mode : null;
  void patchRouteSettings(resolved, { guest_check: v });
}

/** @returns {'heat'|'no_heat'|null} */
export function getPoolHeatMode(propertyId) {
  const id = resolveDbPropertyId(propertyId);
  const row = id ? getRouteSettingsRow(id) : null;
  const v = row?.pool_heat;
  return v === "heat" || v === "no_heat" ? v : null;
}

export function setPoolHeatMode(propertyId, mode) {
  primePropertiesBySlug([propertyId]);
  const resolved = resolveDbPropertyId(propertyId);
  console.log("Supabase write preflight", {
    property_slug: propertyId,
    property_id: resolved,
    onConflict: "property_id",
  });
  if (!resolved) return;
  const v = mode === "heat" || mode === "no_heat" ? mode : null;
  void patchRouteSettings(resolved, { pool_heat: v });
}

/** Display label for technician UI (matches admin segmented defaults when unset). */
export function getGuestCheckLabel(propertyId) {
  return getGuestCheckMode(propertyId) === "check" ? "Check" : "Guest";
}

/** Display label for technician UI (matches admin segmented defaults when unset). */
export function getPoolHeatLabel(propertyId) {
  return getPoolHeatMode(propertyId) === "no_heat" ? "No Pool Heat" : "Pool Heat";
}
