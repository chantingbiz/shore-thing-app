import { supabase } from "./supabaseClient.js";

export function todayISO() {
  return new Date().toISOString().split("T")[0];
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

  if (error) throw error;
  return row;
}

export async function getServiceLogsForToday(techSlug) {
  const { data, error } = await supabase
    .from("service_logs")
    .select(
      "property_id,technician_slug,service_date,pool_hose_started_at,spa_hose_started_at,completed,completed_at,readings_json"
    )
    .eq("technician_slug", techSlug)
    .eq("service_date", todayISO());

  if (error) throw error;
  return data ?? [];
}

export async function logActivity(techSlug, propertyId, actionType) {
  const { error } = await supabase.from("activity_logs").insert({
    technician_slug: techSlug,
    property_id: propertyId,
    action_type: actionType,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function getActivityLogsForToday(techSlug) {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("technician_slug,property_id,action_type,created_at")
    .eq("technician_slug", techSlug)
    .gte("created_at", `${todayISO()}T00:00:00.000Z`)
    .lte("created_at", `${todayISO()}T23:59:59.999Z`)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function updateRouteSettings(propertyId, settings) {
  const payload = { property_id: propertyId, ...settings };
  const { data, error } = await supabase
    .from("route_settings")
    .upsert(payload, { onConflict: "property_id" })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRouteSettings(propertyIds) {
  if (!propertyIds?.length) return [];
  const { data, error } = await supabase
    .from("route_settings")
    .select("property_id,guest_or_check,pool_heat")
    .in("property_id", propertyIds);
  if (error) throw error;
  return data ?? [];
}

