import { supabase } from "./supabaseClient.js";

export function todayISO() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Flatten the technician UI work state into `service_logs` column patch.
 * @param {{ pool: any, spa: any, poolChem: any, spaChem: any }} state
 */
export function mapWorkStateToServiceLogPatch(state) {
  const pool = state?.pool ?? {};
  const spa = state?.spa ?? {};
  const poolChem = state?.poolChem ?? {};
  const spaChem = state?.spaChem ?? {};

  return {
    pool_tb_before: pool.tb?.before ?? "",
    pool_tb_after: pool.tb?.after ?? "",
    pool_fc_before: pool.fc?.before ?? "",
    pool_fc_after: pool.fc?.after ?? "",
    pool_ph_before: pool.ph?.before ?? "",
    pool_ph_after: pool.ph?.after ?? "",
    pool_ta_before: pool.ta?.before ?? "",
    pool_ta_after: pool.ta?.after ?? "",
    pool_temp_set: pool.poolTemp?.before ?? "",

    spa_tb_before: spa.tb?.before ?? "",
    spa_tb_after: spa.tb?.after ?? "",
    spa_fc_before: spa.fc?.before ?? "",
    spa_fc_after: spa.fc?.after ?? "",
    spa_ph_before: spa.ph?.before ?? "",
    spa_ph_after: spa.ph?.after ?? "",
    spa_ta_before: spa.ta?.before ?? "",
    spa_ta_after: spa.ta?.after ?? "",
    spa_temp: spa.spaTemp?.after ?? "",

    pool_pucks: poolChem.pucks ?? "",
    pool_granulated: poolChem.granulated ?? "",
    pool_ta_added: poolChem.ta ?? "",

    spa_mini_pucks: spaChem.pucks ?? "",
    spa_granulated: spaChem.granulated ?? "",
    spa_ta_added: spaChem.ta ?? "",
  };
}

/**
 * @param {string} propertyId uuid
 * @param {string} techSlug
 * @param {object} data
 */
export async function upsertServiceLog(propertyId, techSlug, data) {
  const payload = {
    property_id: propertyId,
    technician_slug: techSlug,
    service_date: todayISO(),
    ...data,
  };

  const { data: row, error } = await supabase
    .from("service_logs")
    .upsert(payload, {
      onConflict: "property_id,technician_slug,service_date",
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error("Supabase write failed", error);
    throw error;
  }
  console.log("Supabase write ok", row);
  return row;
}

export async function getServiceLogsForToday(techSlug) {
  const { data, error } = await supabase
    .from("service_logs")
    .select(
      "property_id,technician_slug,service_date,pool_hose_started_at,spa_hose_started_at,completed,completed_at,pool_tb_before,pool_tb_after,pool_fc_before,pool_fc_after,pool_ph_before,pool_ph_after,pool_ta_before,pool_ta_after,pool_temp_set,spa_tb_before,spa_tb_after,spa_fc_before,spa_fc_after,spa_ph_before,spa_ph_after,spa_ta_before,spa_ta_after,spa_temp,pool_pucks,pool_granulated,pool_ta_added,spa_mini_pucks,spa_granulated,spa_ta_added"
    )
    .eq("technician_slug", techSlug)
    .eq("service_date", todayISO());

  if (error) throw error;
  return data ?? [];
}

export async function logActivity(techSlug, propertyId, eventType, eventLabel) {
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
  const { data, error } = await supabase
    .from("activity_logs")
    .select("technician_slug,property_id,event_type,event_label,created_at")
    .eq("technician_slug", techSlug)
    .gte("created_at", `${todayISO()}T00:00:00.000Z`)
    .lte("created_at", `${todayISO()}T23:59:59.999Z`)
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

