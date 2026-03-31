import { getRouteSettingsRow, patchRouteSettings } from "../lib/supabaseStore.js";

/** @returns {'guest'|'check'|null} */
export function getGuestCheckMode(propertyId) {
  const row = getRouteSettingsRow(propertyId);
  const v = row?.guest_check;
  return v === "guest" || v === "check" ? v : null;
}

export function setGuestCheckMode(propertyId, mode) {
  const v = mode === "guest" || mode === "check" ? mode : null;
  void patchRouteSettings(propertyId, { guest_check: v });
}

/** @returns {'heat'|'no_heat'|null} */
export function getPoolHeatMode(propertyId) {
  const row = getRouteSettingsRow(propertyId);
  const v = row?.pool_heat;
  return v === "heat" || v === "no_heat" ? v : null;
}

export function setPoolHeatMode(propertyId, mode) {
  const v = mode === "heat" || mode === "no_heat" ? mode : null;
  void patchRouteSettings(propertyId, { pool_heat: v });
}

/** Display label for technician UI (matches admin segmented defaults when unset). */
export function getGuestCheckLabel(propertyId) {
  return getGuestCheckMode(propertyId) === "check" ? "Check" : "Guest";
}

/** Display label for technician UI (matches admin segmented defaults when unset). */
export function getPoolHeatLabel(propertyId) {
  return getPoolHeatMode(propertyId) === "no_heat" ? "No Pool Heat" : "Pool Heat";
}
