import { getServiceLogRow, patchServiceLog } from "../lib/supabaseStore.js";

function snapshotKey(techSlug, propertySlug) {
  return `shore_work_snapshot_${techSlug}_${propertySlug}`;
}

export function saveWorkSnapshot(techSlug, propertySlug, data) {
  // Work snapshot is persisted in service_logs.readings_json for realtime sync.
  // We keep propertySlug in the function signature to avoid touching the UI, but
  // callers should also upsert via service log using propertyId elsewhere.
  void snapshotKey(techSlug, propertySlug);
  // Intentionally no-op here; StephenPropertyDetailPage writes readings_json via service log.
}

export function loadWorkSnapshot(techSlug, propertySlug) {
  void snapshotKey(techSlug, propertySlug);
  // Snapshot is now fetched from Supabase service log cache by propertyId in AdminActivityPropertyPage.
  return null;
}

/** Merge current hose timer flags into the saved snapshot (readings may be empty). */
export function patchHoseFlagsOnSnapshot(techSlug, propertySlug) {
  void techSlug;
  void propertySlug;
  // No longer needed; hose state is derived from service_logs timestamps.
}
