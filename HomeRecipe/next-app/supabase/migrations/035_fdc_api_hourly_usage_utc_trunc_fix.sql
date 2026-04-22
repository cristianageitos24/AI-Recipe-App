-- Fix hour bucket + purge cutoff to use UTC (3-arg date_trunc), not session timezone.

CREATE OR REPLACE FUNCTION public.fdc_reserve_outbound_slot(p_cap integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz;
  v_cnt integer;
BEGIN
  IF p_cap IS NULL OR p_cap < 1 THEN
    RETURN jsonb_build_object('allowed', false, 'outbound_calls_after', 0);
  END IF;

  DELETE FROM public.fdc_api_hourly_usage
  WHERE window_start_utc < date_trunc('hour', now(), 'UTC') - interval '90 days';

  v_window := date_trunc('hour', now(), 'UTC');

  v_cnt := NULL;
  INSERT INTO public.fdc_api_hourly_usage (window_start_utc, outbound_calls, updated_at)
  VALUES (v_window, 1, now())
  ON CONFLICT (window_start_utc) DO UPDATE SET
    outbound_calls = public.fdc_api_hourly_usage.outbound_calls + 1,
    updated_at = now()
  WHERE public.fdc_api_hourly_usage.outbound_calls < p_cap
  RETURNING public.fdc_api_hourly_usage.outbound_calls INTO v_cnt;

  IF v_cnt IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', true, 'outbound_calls_after', v_cnt);
  END IF;

  SELECT u.outbound_calls INTO v_cnt
  FROM public.fdc_api_hourly_usage u
  WHERE u.window_start_utc = v_window;

  RETURN jsonb_build_object(
    'allowed', false,
    'outbound_calls_after', COALESCE(v_cnt, 0)
  );
END;
$$;
