import { getLocalDayKey } from "./localDay.js";

const STORAGE_KEY = "shore_property_completion_v1";

function loadRoot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return typeof p === "object" && p !== null ? p : {};
  } catch {
    return {};
  }
}

function saveRoot(root) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} techSlug
 * @param {string} propertySlug
 * @param {boolean} completed
 * @param {string} [dayKey]
 */
export function setPropertyCompletedForDay(
  techSlug,
  propertySlug,
  completed,
  dayKey = getLocalDayKey()
) {
  if (!techSlug || !propertySlug) return;
  const root = loadRoot();
  if (!root[dayKey]) root[dayKey] = {};
  if (!root[dayKey][techSlug]) root[dayKey][techSlug] = {};
  if (completed) {
    root[dayKey][techSlug][propertySlug] = { completedAt: Date.now() };
  } else {
    delete root[dayKey][techSlug][propertySlug];
    if (Object.keys(root[dayKey][techSlug]).length === 0) {
      delete root[dayKey][techSlug];
    }
  }
  saveRoot(root);
}

export function isPropertyCompletedToday(
  techSlug,
  propertySlug,
  dayKey = getLocalDayKey()
) {
  if (!techSlug || !propertySlug) return false;
  const root = loadRoot();
  return !!root[dayKey]?.[techSlug]?.[propertySlug];
}

export function getPropertyCompletedAt(
  techSlug,
  propertySlug,
  dayKey = getLocalDayKey()
) {
  const root = loadRoot();
  return root[dayKey]?.[techSlug]?.[propertySlug]?.completedAt ?? null;
}
