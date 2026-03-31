import { getStephenPropertyBySlug } from "../data/stephenProperties.js";
import { getServiceLogRow, patchServiceLog } from "../lib/supabaseStore.js";
import { getLocalDayKey } from "./localDay.js";

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
  void dayKey;
  if (!techSlug || !propertySlug) return;
  const prop =
    techSlug === "stephen" ? getStephenPropertyBySlug(propertySlug) : null;
  if (!prop?.id) return;
  const nowIso = new Date().toISOString();
  void patchServiceLog(techSlug, prop.id, {
    completed: !!completed,
    completed_at: completed ? nowIso : null,
  });
}

export function isPropertyCompletedToday(
  techSlug,
  propertySlug,
  dayKey = getLocalDayKey()
) {
  void dayKey;
  if (!techSlug || !propertySlug) return false;
  const prop =
    techSlug === "stephen" ? getStephenPropertyBySlug(propertySlug) : null;
  if (!prop?.id) return false;
  const row = getServiceLogRow(techSlug, prop.id);
  return !!row?.completed;
}

export function getPropertyCompletedAt(
  techSlug,
  propertySlug,
  dayKey = getLocalDayKey()
) {
  void dayKey;
  if (!techSlug || !propertySlug) return null;
  const prop =
    techSlug === "stephen" ? getStephenPropertyBySlug(propertySlug) : null;
  if (!prop?.id) return null;
  const row = getServiceLogRow(techSlug, prop.id);
  const t = row?.completed_at ? Date.parse(row.completed_at) : null;
  return Number.isFinite(t) ? t : null;
}
