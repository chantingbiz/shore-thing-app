/**
 * Typical spa fill duration stored on `properties.spa_fill_minutes` (total minutes).
 * UI uses H:MM (e.g. 0:45, 1:25); DB stores integer minutes only.
 */

const MAX_TOTAL_MINUTES = 99999;

function clampMinutes(n) {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), MAX_TOTAL_MINUTES);
}

/**
 * @param {unknown} totalMinutes
 * @returns {string} H:MM display (hours unbounded within cap; minutes zero-padded)
 */
export function spaFillMinutesToDisplay(totalMinutes) {
  const capped = clampMinutes(Number(totalMinutes));
  const h = Math.floor(capped / 60);
  const m = capped % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/**
 * Digit-entry format for spa fill time.
 *
 * Rules:
 * - user types digits only (no colon required)
 * - hours is 0–9 (single digit max)
 * - last two digits are minutes (00–59)
 * - 45  -> 0:45
 * - 100 -> 1:00
 * - 125 -> 1:25
 *
 * @param {string} digits
 * @returns {number | null} total minutes, or null if invalid
 */
export function parseSpaFillDigitsToMinutes(digits) {
  const raw = String(digits ?? "").replace(/\D/g, "").slice(0, 3);
  if (!raw) return null;

  if (raw.length <= 2) {
    const mm = Number(raw);
    if (!Number.isInteger(mm) || mm < 0 || mm > 59) return null;
    return clampMinutes(mm);
  }

  const h = Number(raw[0]);
  const mm = Number(raw.slice(1));
  if (!Number.isInteger(h) || h < 0 || h > 9) return null;
  if (!Number.isInteger(mm) || mm < 0 || mm > 59) return null;
  return clampMinutes(h * 60 + mm);
}

/**
 * @param {string} digits
 * @returns {string} H:MM display for digit-entry (empty => "")
 */
export function spaFillDigitsToDisplay(digits) {
  const raw = String(digits ?? "").replace(/\D/g, "").slice(0, 3);
  if (!raw) return "";
  const minutes = parseSpaFillDigitsToMinutes(raw);
  if (minutes === null) {
    // Show best-effort formatting while typing, even if invalid (e.g. 99).
    const padded = raw.length === 1 ? `0${raw}` : raw;
    if (padded.length <= 2) return `0:${padded.padStart(2, "0")}`;
    return `${padded[0]}:${padded.slice(1).padStart(2, "0")}`;
  }
  return spaFillMinutesToDisplay(minutes);
}

/**
 * @param {unknown} totalMinutes
 * @returns {string} digits suitable for digit-entry input ("" when unset/0)
 */
export function spaFillMinutesToDigits(totalMinutes) {
  const capped = clampMinutes(Number(totalMinutes));
  if (!capped) return "";
  const h = Math.floor(capped / 60);
  const m = capped % 60;
  if (h <= 0) return String(m);
  return `${String(h).slice(0, 1)}${String(m).padStart(2, "0")}`;
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
  return clampMinutes(h * 60 + mm);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isValidSpaFillDisplay(text) {
  return parseSpaFillDisplayToMinutes(text) !== null;
}
