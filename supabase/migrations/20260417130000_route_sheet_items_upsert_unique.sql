-- Supports PostgREST upsert from Route Sheet Dashboard (`onConflict` columns must match a unique index).
-- Run after `route_sheet_items` table exists.
CREATE UNIQUE INDEX IF NOT EXISTS route_sheet_items_week_type_tech_property_uid
  ON public.route_sheet_items (week_start_date, route_type, technician_slug, property_id);
