/** URL-safe slug from a display name. */
export function slugifyPropertyName(name) {
  const s = String(name ?? "")
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "property";
}

/**
 * @param {string} base
 * @param {Set<string>} taken lowercased slugs
 */
export function uniquePropertySlug(base, taken) {
  let slug = slugifyPropertyName(base);
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(`${slug}-${n}`)) n += 1;
  return `${slug}-${n}`;
}
