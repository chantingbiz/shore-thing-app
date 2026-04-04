import { uniquePropertySlug } from "./routeSheetSlug.js";

function normStr(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match DB property by name and/or address for this technician.
 * @param {Array<{ id: string, property_slug: string, name: string, address: string }>} dbRows
 * @param {string} name
 * @param {string} address
 */
export function findPropertyMatch(dbRows, name, address) {
  const n = normStr(name);
  const a = normStr(address);
  if (!n && !a) return null;

  let byName = null;
  let byAddr = null;
  for (const row of dbRows) {
    if (n && normStr(row.name) === n) byName = row;
    if (a.length > 8 && normStr(row.address) === a) byAddr = row;
  }

  if (byName && byAddr) {
    if (byName.id === byAddr.id) {
      return { row: byName, matchStatus: "matched_name_and_address" };
    }
    return { row: byName, matchStatus: "matched_name (address differed)" };
  }
  if (byName) return { row: byName, matchStatus: "matched_name" };
  if (byAddr) return { row: byAddr, matchStatus: "matched_address" };
  return null;
}

/**
 * Build editable review rows from parsed sheet + DB.
 * @param {ReturnType<typeof import('./routeSheetParser.js').parseRouteSheetText>} parsed
 * @param {Array<{ id: string, property_slug: string, name: string, address: string }>} dbRows
 * @param {string} technicianSlug
 */
export function buildRouteSheetReviewRows(parsed, dbRows, technicianSlug) {
  const taken = new Set(dbRows.map((r) => String(r.property_slug).toLowerCase()));
  const out = [];

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const hit = findPropertyMatch(dbRows, p.name, p.address);
    const isUpdate = !!hit;
    const propertySlug = hit
      ? hit.row.property_slug
      : uniquePropertySlug(p.name, taken);

    if (!hit) taken.add(propertySlug.toLowerCase());

    out.push({
      key: `r-${i}-${propertySlug}`,
      name: p.name,
      address: p.address,
      guestCheck: p.routeType,
      heat: p.heat,
      technician_slug: technicianSlug,
      matchStatus: hit ? hit.matchStatus : "no_match — new property",
      action: isUpdate ? "update" : "create",
      existingPropertyId: hit ? hit.row.id : null,
      property_slug: propertySlug,
    });
  }

  return out;
}
