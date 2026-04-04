import { insertProperty, updateProperty, updateRouteSettings } from "../lib/api.js";
import { slugifyPropertyName, uniquePropertySlug } from "./routeSheetSlug.js";

/**
 * @param {Array<{
 *   name: string,
 *   address: string,
 *   guestCheck: 'guest'|'check',
 *   heat: boolean,
 *   technician_slug: string,
 *   action: 'update'|'create',
 *   existingPropertyId: string|null,
 *   property_slug: string,
 * }>} rows
 * @param {Set<string>} existingSlugsLower all slugs for technician before creates (for uniqueness)
 */
export async function applyRouteSheetReviewRows(rows, existingSlugsLower) {
  const taken = new Set(existingSlugsLower);
  const results = { created: 0, updated: 0, errors: [] };

  for (const row of rows) {
    try {
      const guest_check = row.guestCheck === "check" ? "check" : "guest";
      const pool_heat = row.heat ? "heat" : "no_heat";

      if (row.action === "update" && row.existingPropertyId) {
        let slug = row.property_slug;
        await updateProperty(row.existingPropertyId, {
          name: row.name,
          address: row.address,
        });
        await updateRouteSettings(row.existingPropertyId, { guest_check, pool_heat });
        results.updated += 1;
        void slug;
      } else {
        let base = slugifyPropertyName(row.property_slug || row.name);
        let slug = base;
        if (taken.has(slug.toLowerCase())) {
          slug = uniquePropertySlug(row.name, taken);
        }
        taken.add(slug.toLowerCase());
        const inserted = await insertProperty({
          technician_slug: row.technician_slug,
          property_slug: slug,
          name: row.name,
          address: row.address,
        });
        if (inserted?.id) {
          await updateRouteSettings(inserted.id, { guest_check, pool_heat });
          results.created += 1;
        }
      }
    } catch (e) {
      console.error("route sheet row save failed", e);
      results.errors.push({ row: row.name, message: String(e?.message ?? e) });
    }
  }

  return results;
}
