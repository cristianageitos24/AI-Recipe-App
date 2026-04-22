-- Shared hourly counter for outbound USDA FDC HTTP calls (UTC buckets). Server-only via service role + RPC.

CREATE TABLE IF NOT EXISTS public.fdc_api_hourly_usage (
  window_start_utc TIMESTAMPTZ NOT NULL
    PRIMARY KEY,
  outbound_calls INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.fdc_api_hourly_usage IS
  'Server-only: outbound FDC API calls per UTC hour; purged & incremented via fdc_reserve_outbound_slot';

ALTER TABLE public.fdc_api_hourly_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.fdc_api_hourly_usage FROM anon, authenticated;

-- Atomically purge stale rows, then increment if below cap; returns allowed + count after increment or current count at cap.
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

REVOKE ALL ON FUNCTION public.fdc_reserve_outbound_slot(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fdc_reserve_outbound_slot(integer) TO service_role;
