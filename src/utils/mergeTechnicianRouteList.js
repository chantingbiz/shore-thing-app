import { STEPHEN_PROPERTIES } from "../data/stephenProperties.js";

/**
 * Stephen list: static seed entries merged with DB rows (DB wins on same slug).
 * @param {Array<{ id?: string, property_slug: string, name: string, address: string, technician_slug?: string }>} dbList
 * @returns {Array<{ slug: string, name: string, address: string, id: string | null }>}
 */
export function mergeStephenRouteListWithDb(dbList) {
  const map = new Map();
  for (const p of STEPHEN_PROPERTIES) {
    map.set(p.slug, { slug: p.slug, name: p.name, address: p.address, id: null });
  }
  for (const r of dbList) {
    if ((r.technician_slug ?? "stephen").toLowerCase() !== "stephen") continue;
    map.set(r.property_slug, {
      slug: r.property_slug,
      name: r.name,
      address: r.address,
      id: r.id ?? null,
    });
  }
  return [...map.values()];
}
