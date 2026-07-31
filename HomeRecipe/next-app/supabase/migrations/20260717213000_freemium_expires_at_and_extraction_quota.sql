-- Free/Pro freemium: recipe TTL + monthly extraction quota
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS recipes_user_id_expires_at_idx
  ON public.recipes (user_id, expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN public.recipes.expires_at IS 'Free-tier owned recipes expire; NULL means permanent (Pro or shared catalog)';

-- Monthly extraction usage (server/RPC only)
CREATE TABLE IF NOT EXISTS public.extraction_usage_monthly (
  user_id TEXT NOT NULL,
  year_month TEXT NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year_month),
  CONSTRAINT extraction_usage_monthly_count_nonneg CHECK (count >= 0)
);

ALTER TABLE public.extraction_usage_monthly ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon — service_role / SECURITY DEFINER RPC only
REVOKE ALL ON TABLE public.extraction_usage_monthly FROM PUBLIC;
REVOKE ALL ON TABLE public.extraction_usage_monthly FROM anon, authenticated;
GRANT ALL ON TABLE public.extraction_usage_monthly TO service_role;

CREATE OR REPLACE FUNCTION public.consume_extraction_quota(
  p_user_id TEXT,
  p_limit INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ym TEXT := to_char(timezone('utc', now()), 'YYYY-MM');
  v_count INT;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN FALSE;
  END IF;
  IF p_limit IS NULL OR p_limit < 1 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.extraction_usage_monthly (user_id, year_month, count)
  VALUES (p_user_id, v_ym, 0)
  ON CONFLICT (user_id, year_month) DO NOTHING;

  SELECT count INTO v_count
  FROM public.extraction_usage_monthly
  WHERE user_id = p_user_id AND year_month = v_ym
  FOR UPDATE;

  IF v_count >= p_limit THEN
    RETURN FALSE;
  END IF;

  UPDATE public.extraction_usage_monthly
  SET count = count + 1
  WHERE user_id = p_user_id AND year_month = v_ym;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_extraction_quota(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_extraction_quota(TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_extraction_quota(TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.soft_delete_expired_recipes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.recipes
  SET deleted_at = now()
  WHERE expires_at IS NOT NULL
    AND expires_at < now()
    AND deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_expired_recipes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_expired_recipes() TO postgres;

SELECT cron.schedule(
  'soft_delete_expired_recipes_daily',
  '20 3 * * *',
  $$SELECT public.soft_delete_expired_recipes();$$
);

-- Ship-day backfill: Free owned recipes get expires_at from created_at + 30 days
UPDATE public.recipes r
SET expires_at = CASE
  WHEN r.created_at + interval '30 days' > now() THEN r.created_at + interval '30 days'
  ELSE now()
END
FROM public.profiles p
WHERE r.user_id = p.id
  AND r.user_id IS NOT NULL
  AND r.expires_at IS NULL
  AND r.deleted_at IS NULL
  AND COALESCE(p.plan_tier, 'free') <> 'pro'
  AND NOT (
    COALESCE(p.stripe_subscription_status, '') = ANY (ARRAY['active'::text, 'trialing'::text])
  );
