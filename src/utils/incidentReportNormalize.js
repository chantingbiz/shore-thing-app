import { workStateFromServiceLogRow } from "../lib/api.js";

/**
 * Unified shape for incident report UI from either `service_logs` or `service_history` rows.
 * Uses canonical temps via workStateFromServiceLogRow (pool_temp_after / spa_temp_after with legacy fallback).
 *
 * @param {Record<string, unknown> | null | undefined} row
 * @param {'service_logs' | 'service_history'} source
 */
export function normalizeIncidentServiceRow(row, source) {
  if (!row || typeof row !== "object") return null;
  const workState = workStateFromServiceLogRow(row);
  return {
    source,
    id: row.id ?? null,
    propertyId: row.property_id,
    serviceDate: row.service_date,
    technicianSlug: String(row.technician_slug ?? "").trim(),
    propertyName: row.property_name != null ? String(row.property_name) : null,
    photos: {
      poolBefore: row.pool_before_photo_url || null,
      poolAfter: row.pool_after_photo_url || null,
      spaBefore: row.spa_before_photo_url || null,
      spaAfter: row.spa_after_photo_url || null,
    },
    workState,
  };
}

/**
 * @param {'pool' | 'spa'} water
 * @param {ReturnType<typeof normalizeIncidentServiceRow>} normalized
 */
export function turnoverAfterPhotoUrl(water, normalized) {
  if (!normalized?.photos) return null;
  return water === "pool" ? normalized.photos.poolAfter : normalized.photos.spaAfter;
}

/**
 * @param {'pool' | 'spa'} water
 * @param {ReturnType<typeof normalizeIncidentServiceRow>} normalized
 */
export function midweekBeforePhotoUrl(water, normalized) {
  if (!normalized?.photos) return null;
  return water === "pool" ? normalized.photos.poolBefore : normalized.photos.spaBefore;
}

/**
 * @param {'pool' | 'spa'} water
 * @param {ReturnType<typeof normalizeIncidentServiceRow>} normalized
 */
export function midweekAfterPhotoUrl(water, normalized) {
  return turnoverAfterPhotoUrl(water, normalized);
}
