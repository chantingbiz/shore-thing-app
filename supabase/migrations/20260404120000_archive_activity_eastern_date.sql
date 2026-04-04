-- Match activity_snapshot to America/New_York calendar days (same as app service_date / Eastern "today").

CREATE OR REPLACE FUNCTION public.archive_completed_service_logs (p_service_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  INSERT INTO public.service_history (
    property_id,
    technician_slug,
    service_date,
    pool_hose_started_at,
    spa_hose_started_at,
    completed,
    completed_at,
    pool_tb_before,
    pool_tb_after,
    pool_fc_before,
    pool_fc_after,
    pool_ph_before,
    pool_ph_after,
    pool_ta_before,
    pool_ta_after,
    pool_temp_before,
    pool_temp_set,
    spa_tb_before,
    spa_tb_after,
    spa_fc_before,
    spa_fc_after,
    spa_ph_before,
    spa_ph_after,
    spa_ta_before,
    spa_ta_after,
    spa_temp_before,
    spa_temp,
    pool_pucks,
    pool_granulated,
    pool_ta_added,
    spa_mini_pucks,
    spa_granulated,
    spa_ta_added,
    pool_before_photo_url,
    pool_after_photo_url,
    spa_before_photo_url,
    spa_after_photo_url,
    activity_snapshot
  )
  SELECT
    sl.property_id,
    sl.technician_slug,
    sl.service_date,
    sl.pool_hose_started_at,
    sl.spa_hose_started_at,
    sl.completed,
    sl.completed_at,
    sl.pool_tb_before,
    sl.pool_tb_after,
    sl.pool_fc_before,
    sl.pool_fc_after,
    sl.pool_ph_before,
    sl.pool_ph_after,
    sl.pool_ta_before,
    sl.pool_ta_after,
    sl.pool_temp_before,
    sl.pool_temp_set,
    sl.spa_tb_before,
    sl.spa_tb_after,
    sl.spa_fc_before,
    sl.spa_fc_after,
    sl.spa_ph_before,
    sl.spa_ph_after,
    sl.spa_ta_before,
    sl.spa_ta_after,
    sl.spa_temp_before,
    sl.spa_temp,
    sl.pool_pucks,
    sl.pool_granulated,
    sl.pool_ta_added,
    sl.spa_mini_pucks,
    sl.spa_granulated,
    sl.spa_ta_added,
    sl.pool_before_photo_url,
    sl.pool_after_photo_url,
    sl.spa_before_photo_url,
    sl.spa_after_photo_url,
    COALESCE(
      (
        SELECT
          jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.created_at)
        FROM (
          SELECT
            technician_slug,
            property_id,
            event_type,
            event_label,
            created_at
          FROM public.activity_logs a
          WHERE
            a.property_id = sl.property_id
            AND (a.created_at AT TIME ZONE 'America/New_York')::date = sl.service_date
        ) sub
      ),
      '[]'::jsonb
    )
  FROM public.service_logs sl
  WHERE
    sl.service_date = p_service_date
    AND sl.completed IS TRUE
  ON CONFLICT (property_id, service_date) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN jsonb_build_object('inserted', v_inserted);
END;
$$;
