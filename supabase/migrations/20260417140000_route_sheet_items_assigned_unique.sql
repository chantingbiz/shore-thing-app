-- Reassignment-ready upsert target (assigned technician + property per week/type).
DROP INDEX IF EXISTS public.route_sheet_items_week_type_tech_property_uid;

CREATE UNIQUE INDEX IF NOT EXISTS route_sheet_items_week_route_assign_property_uid
  ON public.route_sheet_items (week_start_date, route_type, property_id, assigned_technician_slug);
