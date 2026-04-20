/** Canonical order for pool/spa before/after service photos (matches service log columns). */
export const SERVICE_PHOTO_SLOT_ORDER = [
  { column: "pool_before_photo_url", label: "Pool · before" },
  { column: "pool_after_photo_url", label: "Pool · after" },
  { column: "spa_before_photo_url", label: "Spa · before" },
  { column: "spa_after_photo_url", label: "Spa · after" },
];

/**
 * Labeled photo entries that have a non-empty URL (same order as {@link SERVICE_PHOTO_SLOT_ORDER}).
 *
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {{ label: string, url: string }[]}
 */
export function servicePhotoItemsFromRow(row) {
  if (!row || typeof row !== "object") return [];
  const out = [];
  for (const { column, label } of SERVICE_PHOTO_SLOT_ORDER) {
    const url = String(row[column] ?? "").trim();
    if (url) out.push({ label, url });
  }
  return out;
}
