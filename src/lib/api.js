import { supabase } from "./supabaseClient.js";
import {
  getEasternDayActivityBoundsUtc,
  getTodayEasternDate,
} from "./easternDate.js";

export { getTodayEasternDate } from "./easternDate.js";

/** Supabase Storage bucket for pool/spa before/after images (public read). Must match dashboard bucket id. */
export const SERVICE_PHOTOS_BUCKET = "pool-photos";

const SERVICE_LOG_SELECT_BASE =
  "id,property_id,technician_slug,service_date,pool_hose_started_at,spa_hose_started_at,completed,completed_at,pool_tb_before,pool_tb_after,pool_fc_before,pool_fc_after,pool_ph_before,pool_ph_after,pool_ta_before,pool_ta_after,pool_temp_before,pool_temp_set,pool_temp_after,spa_tb_before,spa_tb_after,spa_fc_before,spa_fc_after,spa_ph_before,spa_ph_after,spa_ta_before,spa_ta_after,spa_temp_before,spa_temp,spa_temp_after,pool_pucks,pool_granulated,pool_ta_added,pool_clarifier,spa_mini_pucks,spa_granulated,spa_ta_added,pool_before_photo_url,pool_after_photo_url,spa_before_photo_url,spa_after_photo_url";

/** `service_logs` columns for Chemicals Added (not TA readings before/after). */
export const SERVICE_LOG_CHEMICAL_COLUMNS = [
  "pool_pucks",
  "pool_granulated",
  "pool_ta_added",
  "pool_clarifier",
  "spa_mini_pucks",
  "spa_granulated",
  "spa_ta_added",
];

function patchIncludesChemicalColumns(patch) {
  if (!patch || typeof patch !== "object") return false;
  return SERVICE_LOG_CHEMICAL_COLUMNS.some((k) =>
    Object.prototype.hasOwnProperty.call(patch, k)
  );
}

/**
 * Chemicals Added → `service_logs` columns (distinct from pool/spa TA readings).
 * Pool: Pucks → pool_pucks, Granulated → pool_granulated, TA → pool_ta_added, Clarifier → pool_clarifier.
 * Spa: Mini Pucks → spa_mini_pucks, Granulated → spa_granulated, TA → spa_ta_added.
 * @param {{ poolChem?: any, spaChem?: any }} state
 */
export function mapChemicalWorkStateToServiceLogPatch(state) {
  const poolChem = state?.poolChem ?? {};
  const spaChem = state?.spaChem ?? {};
  return {
    pool_pucks: poolChem.pucks ?? "",
    pool_granulated: poolChem.granulated ?? "",
    pool_ta_added: poolChem.ta ?? "",
    pool_clarifier: poolChem.clarifier ?? "",
    spa_mini_pucks: spaChem.pucks ?? "",
    spa_granulated: spaChem.granulated ?? "",
    spa_ta_added: spaChem.ta ?? "",
  };
}

/**
 * Readings (before/after) only — includes TA test strips, not chemicals added.
 * @param {{ pool?: any, spa?: any }} state
 */
export function mapReadingsWorkStateToServiceLogPatch(state) {
  const pool = state?.pool ?? {};
  const spa = state?.spa ?? {};
  return {
    pool_tb_before: pool.tb?.before ?? "",
    pool_tb_after: pool.tb?.after ?? "",
    pool_fc_before: pool.fc?.before ?? "",
    pool_fc_after: pool.fc?.after ?? "",
    pool_ph_before: pool.ph?.before ?? "",
    pool_ph_after: pool.ph?.after ?? "",
    pool_ta_before: pool.ta?.before ?? "",
    pool_ta_after: pool.ta?.after ?? "",
    pool_temp_before: pool.poolTemp?.before ?? "",
    pool_temp_set: pool.poolTemp?.after ?? "",
    pool_temp_after: pool.poolTemp?.after ?? "",

    spa_tb_before: spa.tb?.before ?? "",
    spa_tb_after: spa.tb?.after ?? "",
    spa_fc_before: spa.fc?.before ?? "",
    spa_fc_after: spa.fc?.after ?? "",
    spa_ph_before: spa.ph?.before ?? "",
    spa_ph_after: spa.ph?.after ?? "",
    spa_ta_before: spa.ta?.before ?? "",
    spa_ta_after: spa.ta?.after ?? "",
    spa_temp_before: spa.spaTemp?.before ?? "",
    spa_temp: spa.spaTemp?.after ?? "",
    spa_temp_after: spa.spaTemp?.after ?? "",
  };
}

/**
 * Flatten the technician UI work state into `service_logs` column patch.
 * @param {{ pool: any, spa: any, poolChem: any, spaChem: any }} state
 */
export function mapWorkStateToServiceLogPatch(state) {
  return {
    ...mapReadingsWorkStateToServiceLogPatch(state),
    ...mapChemicalWorkStateToServiceLogPatch(state),
  };
}

/** Default nested work state (all empty strings) for new service_logs rows. */
export function emptyNestedWorkStateForServiceLog() {
  const p = () => ({ before: "", after: "" });
  return {
    pool: {
      tb: p(),
      fc: p(),
      ph: p(),
      ta: p(),
      poolTemp: p(),
    },
    spa: {
      tb: p(),
      fc: p(),
      ph: p(),
      ta: p(),
      spaTemp: p(),
    },
    poolChem: { pucks: "", granulated: "", ta: "", clarifier: "" },
    spaChem: { pucks: "", granulated: "", ta: "" },
  };
}

export function emptyServiceLogWorkPatch() {
  return mapWorkStateToServiceLogPatch(emptyNestedWorkStateForServiceLog());
}

/**
 * Flat diff of two reading/chemical patches — only keys whose values changed.
 * @param {Record<string, string>} baseline
 * @param {Record<string, string>} current
 */
export function diffServiceLogPatch(baseline, current) {
  if (!current || typeof current !== "object") return {};
  if (!baseline || typeof baseline !== "object") return { ...current };
  const patch = {};
  for (const k of Object.keys(current)) {
    const b = baseline[k] ?? "";
    const c = current[k] ?? "";
    if (b !== c) patch[k] = current[k];
  }
  return patch;
}

const str = (v) => (v == null ? "" : String(v));

/** Prefer canonical `*_temp_after`; fall back to legacy `pool_temp_set` / `spa_temp` on old rows. */
export function poolTempAfterFromRow(row) {
  if (!row || typeof row !== "object") return "";
  const v = row.pool_temp_after ?? row.pool_temp_set;
  return str(v);
}

export function spaTempAfterFromRow(row) {
  if (!row || typeof row !== "object") return "";
  const v = row.spa_temp_after ?? row.spa_temp;
  return str(v);
}

/**
 * Inverse of mapWorkStateToServiceLogPatch for hydrating ReadingsForm from a service_logs row.
 * @param {Record<string, unknown> | null | undefined} row
 */
export function workStateFromServiceLogRow(row) {
  if (!row) return null;
  return {
    pool: {
      tb: { before: str(row.pool_tb_before), after: str(row.pool_tb_after) },
      fc: { before: str(row.pool_fc_before), after: str(row.pool_fc_after) },
      ph: { before: str(row.pool_ph_before), after: str(row.pool_ph_after) },
      ta: { before: str(row.pool_ta_before), after: str(row.pool_ta_after) },
      poolTemp: {
        before: str(row.pool_temp_before),
        after: poolTempAfterFromRow(row),
      },
    },
    spa: {
      tb: { before: str(row.spa_tb_before), after: str(row.spa_tb_after) },
      fc: { before: str(row.spa_fc_before), after: str(row.spa_fc_after) },
      ph: { before: str(row.spa_ph_before), after: str(row.spa_ph_after) },
      ta: { before: str(row.spa_ta_before), after: str(row.spa_ta_after) },
      spaTemp: {
        before: str(row.spa_temp_before),
        after: spaTempAfterFromRow(row),
      },
    },
    poolChem: {
      pucks: str(row.pool_pucks),
      granulated: str(row.pool_granulated),
      ta: str(row.pool_ta_added),
      clarifier: str(row.pool_clarifier),
    },
    spaChem: {
      pucks: str(row.spa_mini_pucks),
      granulated: str(row.spa_granulated),
      ta: str(row.spa_ta_added),
    },
  };
}

/**
 * @param {string} propertyId uuid
 * @param {string} techSlug
 * @param {object} patch
 */
export async function upsertServiceLog(propertyId, techSlug, patch) {
  const serviceDate = getTodayEasternDate();

  const { data: existing, error: readError } = await supabase
    .from("service_logs")
    .select("*")
    .eq("property_id", propertyId)
    .eq("service_date", serviceDate)
    .maybeSingle();

  if (readError) {
    console.error("service_logs pre-read failed", readError);
    throw readError;
  }

  const merged = {
    ...(existing && typeof existing === "object" ? existing : {}),
    ...patch,
    property_id: propertyId,
    technician_slug: techSlug,
    service_date: serviceDate,
  };

  for (const k of Object.keys(merged)) {
    if (merged[k] === undefined) delete merged[k];
  }

  const chemicalUpsert = patchIncludesChemicalColumns(patch);

  console.log("Supabase write about to run", {
    property_id: merged.property_id,
    service_date: merged.service_date,
    onConflict: "property_id,service_date",
    patchKeys: Object.keys(patch),
  });

  if (chemicalUpsert) {
    console.log("chemical payload keys", Object.keys(patch));
  }

  console.log("UPSERT merged row keys", Object.keys(merged).length);

  const { data, error } = await supabase
    .from("service_logs")
    .upsert(merged, {
      onConflict: "property_id,service_date",
    })
    .select()
    .maybeSingle();

  if (error) {
    if (chemicalUpsert) {
      console.error("chemical save failed", error);
    }
    console.error("Supabase write failed", error);
    throw error;
  }
  if (chemicalUpsert) {
    console.log("chemical result", data);
  }
  console.log("Supabase write ok", data);
  return data;
}

export async function getServiceLogsForToday(techSlug) {
  const { data, error } = await supabase
    .from("service_logs")
    .select(SERVICE_LOG_SELECT_BASE)
    .eq("technician_slug", techSlug)
    .eq("service_date", getTodayEasternDate());

  if (error) throw error;
  return data ?? [];
}

export async function logActivity(techSlug, propertyId, eventType, eventLabel) {
  console.log("Supabase write about to run", {
    property_id: propertyId,
    event_type: eventType,
    event_label: eventLabel,
  });
  const { data, error } = await supabase.from("activity_logs").insert({
    technician_slug: techSlug,
    property_id: propertyId,
    event_type: eventType,
    event_label: eventLabel,
    created_at: new Date().toISOString(),
  });
  if (error) {
    console.error("Supabase write failed", error);
    throw error;
  }
  console.log("Supabase write ok", data);
}

export async function getActivityLogsForToday(techSlug) {
  const { startIso, endExclusiveIso } = getEasternDayActivityBoundsUtc(
    getTodayEasternDate()
  );
  const { data, error } = await supabase
    .from("activity_logs")
    .select("technician_slug,property_id,event_type,event_label,created_at")
    .eq("technician_slug", techSlug)
    .gte("created_at", startIso)
    .lt("created_at", endExclusiveIso)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function updateRouteSettings(propertyId, settings) {
  const payload = {
    property_id: propertyId,
    ...settings,
    updated_at: new Date().toISOString(),
  };
  console.log("Supabase write about to run", {
    property_id: payload.property_id,
    onConflict: "property_id",
  });
  const { data, error } = await supabase
    .from("route_settings")
    .upsert(payload, { onConflict: "property_id" })
    .select()
    .maybeSingle();
  if (error) {
    console.error("Supabase write failed", error);
    throw error;
  }
  console.log("Supabase write ok", data);
  return data;
}

export async function getRouteSettings(propertyIds) {
  if (!propertyIds?.length) return [];
  const { data, error } = await supabase
    .from("route_settings")
    .select("property_id,property_name,technician_slug,guest_check,pool_heat,updated_at")
    .in("property_id", propertyIds);
  if (error) throw error;
  return data ?? [];
}

/**
 * All `route_settings` rows for a technician (defaults for weekly sheet seeding).
 * @param {string} technicianSlug
 */
export async function getRouteSettingsRowsForTechnician(technicianSlug) {
  const slug = String(technicianSlug ?? "").toLowerCase().trim();
  if (!slug) return [];
  const { data, error } = await supabase
    .from("route_settings")
    .select("property_id,property_name,technician_slug,guest_check,pool_heat,updated_at")
    .eq("technician_slug", slug);
  if (error) throw error;
  return data ?? [];
}

/**
 * Weekly sheet rows for one technician + route type + week (editable source if present).
 * Future technician UI: same query shape — filter by `week_start_date`, `route_type`, and
 * `assigned_technician_slug` (fallback `technician_slug` for legacy rows); use `guest_check` for guest vs check.
 *
 * @param {string} weekStartDate YYYY-MM-DD
 * @param {'turnover'|'midweek'} routeType
 * @param {string} technicianSlug
 */
export async function getRouteSheetItemsForWeek(weekStartDate, routeType, technicianSlug) {
  const w = String(weekStartDate ?? "").trim();
  const slug = String(technicianSlug ?? "").toLowerCase().trim();
  if (!w || !slug || (routeType !== "turnover" && routeType !== "midweek")) return [];
  const sel =
    "id,week_start_date,route_type,property_id,property_name,technician_slug,source_technician_slug,assigned_technician_slug,guest_check,pool_heat,comments,included,sent_at,created_at";
  const base = () =>
    supabase.from("route_sheet_items").select(sel).eq("week_start_date", w).eq("route_type", routeType);
  const { data: byAssigned, error: errA } = await base().eq("assigned_technician_slug", slug);
  if (errA) throw errA;
  if (byAssigned?.length) return byAssigned;
  const { data: legacy, error: errL } = await base().eq("technician_slug", slug);
  if (errL) throw errL;
  return legacy ?? [];
}

/**
 * Which assigned technician+route_type combos have a fully-sent sheet this week (every row has `sent_at`).
 * Keys are `${assigned_technician_slug || technician_slug}::${route_type}`.
 * @param {string} weekStartDate YYYY-MM-DD (Saturday anchor)
 * @returns {Promise<Record<string, boolean>>}
 */
export async function getRouteSheetWeekSentSnapshot(weekStartDate) {
  const w = String(weekStartDate ?? "").trim();
  if (!w) return {};
  const { data, error } = await supabase
    .from("route_sheet_items")
    .select("technician_slug,assigned_technician_slug,route_type,sent_at")
    .eq("week_start_date", w);
  if (error) throw error;
  const buckets = {};
  for (const r of data ?? []) {
    const assign = String(r.assigned_technician_slug ?? "").toLowerCase().trim();
    const leg = String(r.technician_slug ?? "").toLowerCase().trim();
    const slug = assign || leg;
    const rt = r.route_type;
    if (!slug || (rt !== "turnover" && rt !== "midweek")) continue;
    const k = `${slug}::${rt}`;
    if (!buckets[k]) buckets[k] = { total: 0, unsent: 0 };
    buckets[k].total++;
    if (r.sent_at == null || String(r.sent_at).trim() === "") buckets[k].unsent++;
  }
  /** @type {Record<string, boolean>} */
  const map = {};
  for (const [k, b] of Object.entries(buckets)) {
    map[k] = b.total > 0 && b.unsent === 0;
  }
  return map;
}

/** Matches `public.route_sheet_items` unique constraint (PostgREST `onConflict`). */
export const ROUTE_SHEET_ITEMS_ON_CONFLICT =
  "week_start_date,route_type,property_id,assigned_technician_slug";

/**
 * Upsert weekly sheet rows. Does not touch `route_settings`.
 * Technician app read path (future): filter `route_sheet_items` by `assigned_technician_slug` (or legacy `technician_slug`) + `week_start_date` + `route_type`; `guest_check` distinguishes guest vs check.
 *
 * @param {Record<string, unknown>[]} rows
 */
export async function upsertRouteSheetItemsBatch(rows) {
  if (!rows?.length) return [];

  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]?.assigned_technician_slug;
    if (a == null || String(a).trim() === "") {
      throw new Error(
        `upsertRouteSheetItemsBatch: row ${i} missing assigned_technician_slug (required for ${ROUTE_SHEET_ITEMS_ON_CONFLICT})`
      );
    }
  }

  console.log("[route_sheet_items] upsert", {
    row_count: rows.length,
    onConflict: ROUTE_SHEET_ITEMS_ON_CONFLICT,
  });

  const { data, error } = await supabase
    .from("route_sheet_items")
    .upsert(rows, { onConflict: ROUTE_SHEET_ITEMS_ON_CONFLICT })
    .select();

  if (error) {
    console.error("[route_sheet_items] upsert error", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      onConflict: ROUTE_SHEET_ITEMS_ON_CONFLICT,
    });
    throw error;
  }

  console.log("[route_sheet_items] upsert ok", {
    returned_row_count: data?.length ?? 0,
    onConflict: ROUTE_SHEET_ITEMS_ON_CONFLICT,
  });
  return data ?? [];
}

export async function getPropertiesBySlugs(propertySlugs) {
  const slugs = (propertySlugs ?? [])
    .map((s) => (typeof s === "string" ? s.toLowerCase() : null))
    .filter(Boolean);
  if (!slugs.length) return [];

  const { data, error } = await supabase
    .from("properties")
    .select("id,property_slug,name,address")
    .in("property_slug", slugs);

  if (error) throw error;
  return data ?? [];
}

export async function getPropertiesByIds(propertyIds) {
  const ids = (propertyIds ?? []).filter(Boolean);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("properties")
    .select("id,property_slug,name,address")
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

/**
 * All properties assigned to a technician (route sheet / DB source).
 * @param {string} technicianSlug
 */
export async function getPropertiesForTechnician(technicianSlug) {
  const slug = (technicianSlug ?? "").toLowerCase();
  if (!slug) return [];
  const { data, error } = await supabase
    .from("properties")
    .select("id,technician_slug,property_slug,name,address,created_at")
    .eq("technician_slug", slug)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * @param {string} technicianSlug
 * @param {string} propertySlug
 */
export async function getPropertyByTechnicianAndSlug(technicianSlug, propertySlug) {
  const ts = (technicianSlug ?? "").toLowerCase();
  const ps = (propertySlug ?? "").toLowerCase();
  if (!ts || !ps) return null;
  const { data, error } = await supabase
    .from("properties")
    .select("id,technician_slug,property_slug,name,address,created_at")
    .eq("technician_slug", ts)
    .eq("property_slug", ps)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * @param {{ technician_slug: string, property_slug: string, name: string, address: string }} row
 */
export async function insertProperty(row) {
  const { data, error } = await supabase
    .from("properties")
    .insert({
      technician_slug: row.technician_slug,
      property_slug: row.property_slug,
      name: row.name,
      address: row.address,
    })
    .select("id,technician_slug,property_slug,name,address,created_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * @param {string} propertyId
 * @param {{ name?: string, address?: string, property_slug?: string }} patch
 */
export async function updateProperty(propertyId, patch) {
  if (!propertyId) return null;
  const payload = { ...patch };
  const { data, error } = await supabase
    .from("properties")
    .update(payload)
    .eq("id", propertyId)
    .select("id,technician_slug,property_slug,name,address,created_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}

function extFromFile(file) {
  const name = file?.name || "";
  const m = /\.([a-z0-9]+)$/i.exec(name);
  if (m) return m[1].toLowerCase();
  const t = file?.type || "";
  if (t === "image/jpeg") return "jpg";
  if (t === "image/png") return "png";
  if (t === "image/webp") return "webp";
  if (t === "image/gif") return "gif";
  return "jpg";
}

/**
 * Upload one image to Storage; returns public URL for storing on service_logs.
 * @param {File} file
 * @param {{ propertyId: string, slot: string, serviceLogId?: string | null }} opts
 */
export async function uploadServicePhoto(file, { propertyId, slot, serviceLogId }) {
  console.log("[service photo] selected file", {
    name: file?.name,
    type: file?.type,
    size: file?.size,
  });
  console.log("[service photo] bucket", SERVICE_PHOTOS_BUCKET);

  const ext = extFromFile(file);
  const ts = Date.now();
  const logFolder =
    serviceLogId && String(serviceLogId).trim() ? String(serviceLogId).trim() : "new";
  const filePath = `${propertyId}/${logFolder}/${slot}-${ts}.${ext}`;
  console.log("[service photo] filePath", filePath);

  const contentType =
    file.type && String(file.type).trim()
      ? file.type
      : ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";

  const { data: uploadData, error } = await supabase.storage.from("pool-photos").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType,
  });
  console.log("[service photo] upload result", { uploadData, error });
  if (error) {
    console.error("[service photo] upload threw", error);
    throw error;
  }

  const { data: publicUrlData } = supabase.storage.from("pool-photos").getPublicUrl(filePath);
  const publicUrl = publicUrlData.publicUrl;
  console.log("[service photo] publicUrl", publicUrl);
  return { path: filePath, publicUrl };
}

/**
 * Archive completed service_logs for the given Eastern calendar date into service_history (skips duplicate property+date).
 * RPC also removes matching live rows: completed service_logs and that day’s activity_logs for archived properties (when deployed migration is applied).
 * @param {string} serviceDate YYYY-MM-DD
 * @returns {Promise<{ inserted?: number, deleted_service_logs?: number, deleted_activity_logs?: number } | unknown>}
 */
export async function archiveCompletedServiceLogs(serviceDate) {
  const { data, error } = await supabase.rpc("archive_completed_service_logs", {
    p_service_date: serviceDate,
  });
  if (error) {
    console.error("archive_completed_service_logs RPC failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      raw: error,
    });
    throw error;
  }
  return data;
}

/**
 * @param {{ startDate?: string, endDate?: string, limit?: number }} opts
 */
export async function getServiceHistoryRows(opts = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 300, 1), 500);
  let q = supabase
    .from("service_history")
    .select("*")
    .order("service_date", { ascending: false })
    .limit(limit);
  if (opts.startDate) q = q.gte("service_date", opts.startDate);
  if (opts.endDate) q = q.lte("service_date", opts.endDate);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** Escape `%` / `_` for PostgREST `ilike` patterns. */
function escapeIlikePattern(text) {
  return text.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Search properties by name, address, or slug (admin incident report / lookup).
 * Uses parallel ilike queries and merges by id (avoids fragile `.or()` pattern strings).
 * @param {string} searchText
 * @param {number} [limit]
 */
export async function searchPropertiesForAdmin(searchText, limit = 40) {
  const raw = (searchText ?? "").trim().replace(/,/g, " ");
  if (!raw) return [];
  const pattern = `%${escapeIlikePattern(raw)}%`;
  const cap = Math.min(Math.max(limit, 1), 100);
  const sel = "id,property_slug,name,address,technician_slug";
  const [byName, bySlug, byAddr] = await Promise.all([
    supabase.from("properties").select(sel).ilike("name", pattern).order("name", { ascending: true }).limit(cap),
    supabase.from("properties").select(sel).ilike("property_slug", pattern).order("name", { ascending: true }).limit(cap),
    supabase.from("properties").select(sel).ilike("address", pattern).order("name", { ascending: true }).limit(cap),
  ]);
  if (byName.error) throw byName.error;
  if (bySlug.error) throw bySlug.error;
  if (byAddr.error) throw byAddr.error;
  const byId = new Map();
  for (const row of [...(byName.data ?? []), ...(bySlug.data ?? []), ...(byAddr.data ?? [])]) {
    byId.set(row.id, row);
  }
  return Array.from(byId.values())
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { sensitivity: "base" }))
    .slice(0, cap);
}

/**
 * One service row for a property + Eastern calendar date: prefer live `service_logs`, else `service_history`.
 * @param {string} propertyId uuid
 * @param {string} serviceDate YYYY-MM-DD
 * @returns {Promise<{ row: Record<string, unknown> | null, source: 'service_logs' | 'service_history' | null }>}
 */
export async function getServiceRecordForPropertyDate(propertyId, serviceDate) {
  if (!propertyId || !serviceDate) return { row: null, source: null };
  const { data: log, error: errLog } = await supabase
    .from("service_logs")
    .select(SERVICE_LOG_SELECT_BASE)
    .eq("property_id", propertyId)
    .eq("service_date", serviceDate)
    .maybeSingle();
  if (errLog) throw errLog;
  if (log) return { row: log, source: "service_logs" };
  const { data: hist, error: errHist } = await supabase
    .from("service_history")
    .select("*")
    .eq("property_id", propertyId)
    .eq("service_date", serviceDate)
    .maybeSingle();
  if (errHist) throw errHist;
  if (hist) return { row: hist, source: "service_history" };
  return { row: null, source: null };
}

