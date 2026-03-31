import { getServiceLogRow, patchServiceLog } from "../lib/supabaseStore.js";

/**
 * Supabase-backed hose state.
 * These getters remain synchronous (read from cache), while setters patch Supabase async.
 */

/** @returns {number|null} ms timestamp */
export function getPoolStart(techSlug, propertyId) {
  // filled in by propertyCompletion/serviceLog cache in supabaseStore; return null if not loaded yet
  const row = getServiceLogRow(techSlug, propertyId);
  const t = row?.pool_hose_started_at ? Date.parse(row.pool_hose_started_at) : null;
  return Number.isFinite(t) ? t : null;
}

/** @returns {number|null} ms timestamp */
export function getSpaStart(techSlug, propertyId) {
  const row = getServiceLogRow(techSlug, propertyId);
  const t = row?.spa_hose_started_at ? Date.parse(row.spa_hose_started_at) : null;
  return Number.isFinite(t) ? t : null;
}

export function setPoolStart(techSlug, propertyId, timestampMs) {
  const iso = new Date(timestampMs).toISOString();
  void patchServiceLog(techSlug, propertyId, { pool_hose_started_at: iso });
}

export function setSpaStart(techSlug, propertyId, timestampMs) {
  const iso = new Date(timestampMs).toISOString();
  void patchServiceLog(techSlug, propertyId, { spa_hose_started_at: iso });
}

export function clearPool(techSlug, propertyId) {
  void patchServiceLog(techSlug, propertyId, { pool_hose_started_at: null });
}

export function clearSpa(techSlug, propertyId) {
  void patchServiceLog(techSlug, propertyId, { spa_hose_started_at: null });
}

/** Elapsed whole seconds from start timestamp to now */
export function elapsedSecondsSince(startTimestamp, nowMs = Date.now()) {
  return Math.max(0, Math.floor((nowMs - startTimestamp) / 1000));
}

export function formatHoseElapsed(totalSeconds) {
  if (totalSeconds < 3600) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
