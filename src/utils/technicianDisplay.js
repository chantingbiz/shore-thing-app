/**
 * Display-only formatting for technician slugs stored in lowercase (e.g. "stephen" → "Stephen").
 * Do not use for URLs, API payloads, or database keys — keep those as the canonical slug.
 *
 * @param {string | null | undefined} slug
 * @returns {string}
 */
export function formatTechnicianSlugForDisplay(slug) {
  const s = String(slug ?? "").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
