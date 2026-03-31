import { getPoolStart, getSpaStart } from "./hoseTimers.js";

function snapshotKey(techSlug, propertySlug) {
  return `shore_work_snapshot_${techSlug}_${propertySlug}`;
}

export function saveWorkSnapshot(techSlug, propertySlug, data) {
  try {
    localStorage.setItem(
      snapshotKey(techSlug, propertySlug),
      JSON.stringify({
        ...data,
        savedAt: Date.now(),
      })
    );
  } catch {
    /* ignore */
  }
}

export function loadWorkSnapshot(techSlug, propertySlug) {
  try {
    const raw = localStorage.getItem(snapshotKey(techSlug, propertySlug));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Merge current hose timer flags into the saved snapshot (readings may be empty). */
export function patchHoseFlagsOnSnapshot(techSlug, propertySlug) {
  const prev = loadWorkSnapshot(techSlug, propertySlug) || {};
  saveWorkSnapshot(techSlug, propertySlug, {
    ...prev,
    poolHoseActive: getPoolStart(propertySlug) != null,
    spaHoseActive: getSpaStart(propertySlug) != null,
  });
}
