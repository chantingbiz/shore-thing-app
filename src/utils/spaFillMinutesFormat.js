/**
 * Typical spa fill duration stored on `properties.spa_fill_minutes` (total minutes).
 * UI uses H:MM (e.g. 0:45, 1:25); DB stores integer minutes only.
 */

const MAX_TOTAL_MINUTES = 99999;

/**
 * @param {unknown} totalMinutes
 * @returns {string} H:MM display (hours unbounded within cap; minutes zero-padded)
 */
export function spaFillMinutesToDisplay(totalMinutes) {
  const n = Number(totalMinutes);
  if (!Number.isFinite(n) || n < 0) return "0:00";
  const capped = Math.min(Math.floor(n), MAX_TOTAL_MINUTES);
  const h = Math.floor(capped / 60);
  const m = capped % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/**
 * Parse timer-style H:MM. Minutes must be 0–59.
 *
 * @param {string} text
 * @returns {number | null} total minutes, or null if invalid
 */
export function parseSpaFillDisplayToMinutes(text) {
  const s = String(text ?? "").trim();
  if (!s) return null;
  const match = /^\s*(\d+)\s*:\s*([0-5]?\d)\s*$/.exec(s);
  if (!match) return null;
  const h = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isInteger(h) || h < 0 || !Number.isInteger(mm) || mm < 0 || mm > 59) {
    return null;
  }
  const total = h * 60 + mm;
  if (total > MAX_TOTAL_MINUTES) return null;
  return total;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isValidSpaFillDisplay(text) {
  return parseSpaFillDisplayToMinutes(text) !== null;
}
