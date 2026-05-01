/**
 * Typical spa fill duration on `properties.spa_fill_minutes` (total minutes, integer).
 * Technician UI: hours (0–2) × minutes (0,10,…,50); max 2h 50m = 170.
 */

/** @type {readonly [0, 1, 2]} */
export const SPA_FILL_HOUR_OPTIONS = Object.freeze([0, 1, 2]);

/** @type {readonly [0, 10, 20, 30, 40, 50]} */
export const SPA_FILL_MINUTE_STEP_OPTIONS = Object.freeze([0, 10, 20, 30, 40, 50]);

const MAX_SPA_FILL_TOTAL = 2 * 60 + 50;

function clampIncomingTotal(n) {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), MAX_SPA_FILL_TOTAL);
}

/**
 * Map DB minutes to the nearest valid dropdown pair (legacy values may not sit on the grid).
 * @param {unknown} totalMinutes
 * @returns {{ hours: 0|1|2, minutes: 0|10|20|30|40|50 }}
 */
export function totalMinutesToDropdownValues(totalMinutes) {
  const target = clampIncomingTotal(Number(totalMinutes));
  let bestH = 0;
  let bestM = 0;
  let bestDist = Infinity;
  for (const h of SPA_FILL_HOUR_OPTIONS) {
    for (const m of SPA_FILL_MINUTE_STEP_OPTIONS) {
      const t = h * 60 + m;
      const d = Math.abs(t - target);
      if (d < bestDist || (d === bestDist && t < bestH * 60 + bestM)) {
        bestDist = d;
        bestH = h;
        bestM = m;
      }
    }
  }
  return { hours: bestH, minutes: bestM };
}

/**
 * @param {number} hours
 * @param {number} minutes
 * @returns {number}
 */
export function dropdownValuesToTotalMinutes(hours, minutes) {
  const h = SPA_FILL_HOUR_OPTIONS.includes(hours) ? hours : 0;
  const m = SPA_FILL_MINUTE_STEP_OPTIONS.includes(minutes) ? minutes : 0;
  return h * 60 + m;
}

/**
 * Preview line: H:MM when hours ≥ 1; otherwise "N min" for sub-hour targets.
 * @param {number} totalMinutes
 */
export function formatSpaFillTargetPreview(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return "Target: 0 min";
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h >= 1) {
    return `Target: ${h}:${String(m).padStart(2, "0")}`;
  }
  return `Target: ${m} min`;
}
