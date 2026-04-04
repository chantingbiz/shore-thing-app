function normLoose(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize any heat-ish input to the only two values allowed in `route_settings.pool_heat`.
 * @param {unknown} value
 * @returns {"pool_heat"|"no_pool_heat"}
 */
export function normalizePoolHeatToDb(value) {
  if (typeof value === "boolean") return value ? "pool_heat" : "no_pool_heat";
  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0 ? "pool_heat" : "no_pool_heat";
  }
  const s = normLoose(value);
  if (!s) return "no_pool_heat";

  const underscored = s.replace(/ /g, "_");

  const on = new Set(["true", "yes", "heat", "pool heat", "pool_heat"]);
  const off = new Set(["false", "no", "no heat", "no pool heat", "no_pool_heat", "no_heat"]);

  if (on.has(s) || underscored === "pool_heat") return "pool_heat";
  if (off.has(s) || underscored === "no_pool_heat" || underscored === "no_heat") {
    return "no_pool_heat";
  }

  return "no_pool_heat";
}

/**
 * Map a stored DB value (including legacy `heat` / `no_heat`) to canonical form for comparisons.
 * @param {unknown} stored
 * @returns {"pool_heat"|"no_pool_heat"}
 */
export function canonicalPoolHeatFromDb(stored) {
  return normalizePoolHeatToDb(stored);
}
