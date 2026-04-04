import {
  getRouteSettings,
  insertProperty,
  updateProperty,
  updateRouteSettings,
} from "../lib/api.js";
import { canonicalPoolHeatFromDb, normalizePoolHeatToDb } from "./poolHeatDb.js";
import { slugifyPropertyName, uniquePropertySlug } from "./routeSheetSlug.js";

function normStr(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Apply review rows only where data differs from DB; returns a structured summary for the UI.
 *
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
 * @param {Set<string>} existingSlugsLower
 * @param {Array<{ id: string, property_slug: string, name: string, address: string }>} dbRows
 */
export async function applyRouteSheetReviewRows(rows, existingSlugsLower, dbRows) {
  const taken = new Set(existingSlugsLower);
  const dbById = new Map(dbRows.map((r) => [r.id, r]));

  const propertyIds = dbRows.map((r) => r.id).filter(Boolean);
  const settingsRows = propertyIds.length ? await getRouteSettings(propertyIds) : [];
  const settingsByPropId = new Map(
    settingsRows.map((s) => [s.property_id, { guest_check: s.guest_check, pool_heat: s.pool_heat }])
  );

  const summary = {
    errors: [],
    matchedExistingCount: 0,
    createdCount: 0,
    createdPropertyNames: [],
    nameAddressChangeNames: [],
    routeStatusChangeNames: [],
    heatChangeNames: [],
  };

  for (const row of rows) {
    const displayName = row.name || row.property_slug || "Property";
    const desiredGuest = row.guestCheck === "check" ? "check" : "guest";
    const desiredPoolHeat = normalizePoolHeatToDb(row.heat);

    try {
      if (row.action === "update" && row.existingPropertyId) {
        const existing = dbById.get(row.existingPropertyId);
        if (!existing) {
          summary.errors.push({ row: displayName, message: "Missing existing property in cache" });
          continue;
        }
        summary.matchedExistingCount += 1;

        const prevSettings = settingsByPropId.get(row.existingPropertyId) ?? {
          guest_check: "guest",
          pool_heat: "no_pool_heat",
        };

        const nameChanged = normStr(existing.name) !== normStr(row.name);
        const addrChanged = normStr(existing.address) !== normStr(row.address);
        if (nameChanged || addrChanged) {
          await updateProperty(row.existingPropertyId, {
            name: row.name,
            address: row.address,
          });
          summary.nameAddressChangeNames.push(displayName);
          existing.name = row.name;
          existing.address = row.address;
        }

        const routeChanged = (prevSettings.guest_check || "guest") !== desiredGuest;
        const prevPoolHeat = canonicalPoolHeatFromDb(prevSettings.pool_heat);
        const heatChanged = prevPoolHeat !== desiredPoolHeat;

        if (routeChanged || heatChanged) {
          await updateRouteSettings(row.existingPropertyId, {
            guest_check: desiredGuest,
            pool_heat: desiredPoolHeat,
          });
          settingsByPropId.set(row.existingPropertyId, {
            guest_check: desiredGuest,
            pool_heat: desiredPoolHeat,
          });
          if (routeChanged) summary.routeStatusChangeNames.push(displayName);
          if (heatChanged) summary.heatChangeNames.push(displayName);
        }
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
          await updateRouteSettings(inserted.id, {
            guest_check: desiredGuest,
            pool_heat: desiredPoolHeat,
          });
          summary.createdCount += 1;
          summary.createdPropertyNames.push(row.name || inserted.property_slug || "Property");
        }
      }
    } catch (e) {
      console.error("route sheet row save failed", e);
      summary.errors.push({ row: displayName, message: String(e?.message ?? e) });
    }
  }

  summary.hadAnyEffectiveChange =
    summary.createdCount > 0 ||
    summary.nameAddressChangeNames.length > 0 ||
    summary.routeStatusChangeNames.length > 0 ||
    summary.heatChangeNames.length > 0;

  return summary;
}
