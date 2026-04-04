import { supabase } from "./supabaseClient.js";
import {
  getEasternDayActivityBoundsUtc,
  getTodayEasternDate,
} from "./easternDate.js";

export { getTodayEasternDate } from "./easternDate.js";

/** Supabase Storage bucket for pool/spa before/after images (public read). */
export const SERVICE_PHOTOS_BUCKET = "service-photos";

const SERVICE_LOG_SELECT_BASE =
  "property_id,technician_slug,service_date,pool_hose_started_at,spa_hose_started_at,completed,completed_at,pool_tb_before,pool_tb_after,pool_fc_before,pool_fc_after,pool_ph_before,pool_ph_after,pool_ta_before,pool_ta_after,pool_temp_before,pool_temp_set,spa_tb_before,spa_tb_after,spa_fc_before,spa_fc_after,spa_ph_before,spa_ph_after,spa_ta_before,spa_ta_after,spa_temp_before,spa_temp,pool_pucks,pool_granulated,pool_ta_added,spa_mini_pucks,spa_granulated,spa_ta_added,pool_before_photo_url,pool_after_photo_url,spa_before_photo_url,spa_after_photo_url";

/** `service_logs` columns for Chemicals Added (not TA readings before/after). */
export const SERVICE_LOG_CHEMICAL_COLUMNS = [
  "pool_pucks",
  "pool_granulated",
  "pool_ta_added",
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
 * Pool: Pucks → pool_pucks, Granulated → pool_granulated, TA → pool_ta_added.
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

const str = (v) => (v == null ? "" : String(v));

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
        after: str(row.pool_temp_set),
      },
    },
    spa: {
      tb: { before: str(row.spa_tb_before), after: str(row.spa_tb_after) },
      fc: { before: str(row.spa_fc_before), after: str(row.spa_fc_after) },
      ph: { before: str(row.spa_ph_before), after: str(row.spa_ph_after) },
      ta: { before: str(row.spa_ta_before), after: str(row.spa_ta_after) },
      spaTemp: {
        before: str(row.spa_temp_before),
        after: str(row.spa_temp),
      },
    },
    poolChem: {
      pucks: str(row.pool_pucks),
      granulated: str(row.pool_granulated),
      ta: str(row.pool_ta_added),
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
  const payload = {
    property_id: propertyId,
    technician_slug: techSlug,
    service_date: getTodayEasternDate(),
    ...patch,
  };

  const onConflict = "property_id,service_date";
  const chemicalUpsert = patchIncludesChemicalColumns(patch);
  if (chemicalUpsert) {
    console.log("chemical payload", payload);
  }

  console.log("Supabase write about to run", {
    property_id: payload.property_id,
    service_date: payload.service_date,
    onConflict,
  });

  const row = payload;
  console.log("UPSERT ROW:", row);

  const { data, error } = await supabase
    .from("service_logs")
    .upsert(payload, {
      onConflict,
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
    .select("property_id,guest_check,pool_heat,updated_at")
    .in("property_id", propertyIds);
  if (error) throw error;
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
 * @param {{ techSlug: string, propertyId: string, serviceDate: string, slot: string }} opts
 */
export async function uploadServicePhoto(file, { techSlug, propertyId, serviceDate, slot }) {
  const ext = extFromFile(file);
  const uid =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now());
  const path = `${techSlug}/${propertyId}/${serviceDate}/${slot}-${uid}.${ext}`;
  const { data, error } = await supabase.storage.from(SERVICE_PHOTOS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(SERVICE_PHOTOS_BUCKET).getPublicUrl(data.path);
  return { path: data.path, publicUrl: pub.publicUrl };
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
  if (error) throw error;
  return data;
}

/**
 * @param {{ startDate?: string, endDate?: string, limit?: number }} opts
 */
export async function getServiceHistoryRows(opts = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 300, 1), 500);
  let q = supabase
    .from("service_history")
    .select(SERVICE_LOG_SELECT_BASE + ",id,activity_snapshot")
    .order("service_date", { ascending: false })
    .limit(limit);
  if (opts.startDate) q = q.gte("service_date", opts.startDate);
  if (opts.endDate) q = q.lte("service_date", opts.endDate);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

