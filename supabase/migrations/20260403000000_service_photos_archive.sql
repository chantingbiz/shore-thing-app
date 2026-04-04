-- Shore Thing: service log photo columns, service_history archive table, archive RPC, storage bucket.
-- Apply in Supabase SQL editor or via CLI. Adjust if your existing service_history definition differs.

ALTER TABLE public.service_logs
  ADD COLUMN IF NOT EXISTS pool_before_photo_url text,
  ADD COLUMN IF NOT EXISTS pool_after_photo_url text,
  ADD COLUMN IF NOT EXISTS spa_before_photo_url text,
  ADD COLUMN IF NOT EXISTS spa_after_photo_url text;

CREATE TABLE IF NOT EXISTS public.service_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  technician_slug text NOT NULL,
  service_date date NOT NULL,
  pool_hose_started_at timestamptz,
  spa_hose_started_at timestamptz,
  completed boolean,
  completed_at timestamptz,
  pool_tb_before text,
  pool_tb_after text,
  pool_fc_before text,
  pool_fc_after text,
  pool_ph_before text,
  pool_ph_after text,
  pool_ta_before text,
  pool_ta_after text,
  pool_temp_before text,
  pool_temp_set text,
  spa_tb_before text,
  spa_tb_after text,
  spa_fc_before text,
  spa_fc_after text,
  spa_ph_before text,
  spa_ph_after text,
  spa_ta_before text,
  spa_ta_after text,
  spa_temp_before text,
  spa_temp text,
  pool_pucks text,
  pool_granulated text,
  pool_ta_added text,
  spa_mini_pucks text,
  spa_granulated text,
  spa_ta_added text,
  pool_before_photo_url text,
  pool_after_photo_url text,
  spa_before_photo_url text,
  spa_after_photo_url text,
  activity_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT service_history_property_service_date_key UNIQUE (property_id, service_date)
);

ALTER TABLE public.service_history
  ADD COLUMN IF NOT EXISTS pool_before_photo_url text,
  ADD COLUMN IF NOT EXISTS pool_after_photo_url text,
  ADD COLUMN IF NOT EXISTS spa_before_photo_url text,
  ADD COLUMN IF NOT EXISTS spa_after_photo_url text;

ALTER TABLE public.service_history
  ADD COLUMN IF NOT EXISTS activity_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;

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

GRANT EXECUTE ON FUNCTION public.archive_completed_service_logs (date) TO anon;
GRANT EXECUTE ON FUNCTION public.archive_completed_service_logs (date) TO authenticated;
-- Rows are inserted only via the SECURITY DEFINER RPC (not direct client inserts).
GRANT SELECT ON public.service_history TO anon;
GRANT SELECT ON public.service_history TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('service-photos', 'service-photos', true)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public;

DROP POLICY IF EXISTS "service_photos_public_read" ON storage.objects;
CREATE POLICY "service_photos_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'service-photos');

DROP POLICY IF EXISTS "service_photos_anon_insert" ON storage.objects;
CREATE POLICY "service_photos_anon_insert" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'service-photos');
