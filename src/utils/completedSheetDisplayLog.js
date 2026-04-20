/**
 * Shared helpers for Completed Sheets snapshot + property detail (same visit-window log pick).
 *
 * @param {string[]} ymds
 */
export function ymdMinMax(ymds) {
  const list = (ymds ?? []).filter(Boolean).sort();
  if (!list.length) return { min: "", max: "" };
  return { min: list[0], max: list[list.length - 1] };
}

function scoreLogFilled(row) {
  if (!row || typeof row !== "object") return 0;
  let n = 0;
  for (const k of Object.keys(row)) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") n++;
  }
  return n;
}

/**
 * Prefer a completed row with the richest payload for read-only work view.
 *
 * @param {Record<string, unknown>[]} logs
 */
export function pickDisplayServiceLog(logs) {
  if (!logs?.length) return null;
  const scored = logs.map((r) => ({
    r,
    completed: !!r.completed,
    score: scoreLogFilled(r),
    sd: String(r.service_date ?? ""),
  }));
  scored.sort((a, b) => {
    if (a.completed !== b.completed) return (b.completed ? 1 : 0) - (a.completed ? 1 : 0);
    if (b.score !== a.score) return b.score - a.score;
    return b.sd.localeCompare(a.sd);
  });
  return scored[0].r;
}
