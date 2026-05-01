/**
 * `service_logs.pool_clarifier`: new entries are ounces (e.g. 5). Legacy rows used
 * fractional “bottles” (e.g. 0.25). We show the correct unit so old logs stay readable.
 *
 * @param {unknown} stored
 * @returns {"" | string} e.g. `"5 oz"` or `"0.25 bottle"`
 */
export function formatPoolClarifierWithUnit(stored) {
  const raw = String(stored ?? "").trim();
  if (!raw) return "";
  const n = Number(String(raw).replace(",", "."));
  if (Number.isFinite(n) && n > 0 && n < 1) {
    return `${raw} bottle`;
  }
  if (!Number.isFinite(n)) {
    return `${raw} oz`;
  }
  return `${raw} oz`;
}

/**
 * @param {unknown} stored
 * @returns {"oz" | "bottle"}
 */
export function poolClarifierUnitSuffix(stored) {
  const raw = String(stored ?? "").trim();
  if (!raw) return "oz";
  const n = Number(String(raw).replace(",", "."));
  if (Number.isFinite(n) && n > 0 && n < 1) return "bottle";
  return "oz";
}
