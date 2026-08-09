-- Video job claim: reclaim stuck processing, honor available_at backoff, return source fields.
-- Lock timeout default raised to 20 minutes to support up-to-4-minute jobs + multimodal.

ALTER TABLE public.video_processing_jobs
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.video_processing_jobs.available_at IS
  'When set, claim_video_job will not pick this job until this time (retry backoff).';

-- Remove legacy single-arg overload so reclaim/backoff always apply
DROP FUNCTION IF EXISTS public.claim_video_job(TEXT);

CREATE OR REPLACE FUNCTION public.claim_video_job(
  worker_id TEXT,
  lock_timeout_minutes INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  user_id TEXT,
  status TEXT,
  video_url TEXT,
  tiktok_url TEXT,
  attempts INT,
  locked_at TIMESTAMPTZ,
  source_type TEXT,
  source_url TEXT,
  source_platform TEXT
) AS $$
DECLARE
  claimed_job RECORD;
  v_lock INTERVAL;
BEGIN
  v_lock := make_interval(mins => GREATEST(COALESCE(lock_timeout_minutes, 20), 1));

  -- Reclaim stale processing jobs so dead workers do not leave permanent zombies
  UPDATE public.video_processing_jobs AS stuck
  SET
    status = 'uploaded',
    locked_at = NULL,
    locked_by = NULL,
    started_at = NULL,
    processing_progress = 0,
    processing_stage = NULL,
    processing_detail = NULL,
    updated_at = NOW()
  WHERE stuck.status = 'processing'
    AND stuck.locked_at IS NOT NULL
    AND stuck.locked_at < NOW() - v_lock;

  UPDATE public.video_processing_jobs AS vpj
  SET
    status = 'processing',
    locked_at = NOW(),
    locked_by = worker_id,
    attempts = vpj.attempts + 1,
    started_at = NOW(),
    updated_at = NOW(),
    available_at = NULL,
    processing_progress = 0,
    processing_stage = NULL,
    processing_detail = NULL
  WHERE vpj.id = (
    SELECT v2.id FROM public.video_processing_jobs v2
    WHERE v2.status = 'uploaded'
      AND (v2.available_at IS NULL OR v2.available_at <= NOW())
      AND (v2.locked_at IS NULL OR v2.locked_at < NOW() - v_lock)
    ORDER BY v2.created_at ASC
    LIMIT 1
    FOR UPDATE OF v2 SKIP LOCKED
  )
  RETURNING * INTO claimed_job;

  IF claimed_job.id IS NOT NULL THEN
    RETURN QUERY SELECT
      claimed_job.id,
      claimed_job.user_id,
      claimed_job.status,
      claimed_job.video_url,
      claimed_job.tiktok_url,
      claimed_job.attempts,
      claimed_job.locked_at,
      claimed_job.source_type,
      claimed_job.source_url,
      claimed_job.source_platform;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.refund_extraction_quota(p_user_id TEXT)
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

  SELECT count INTO v_count
  FROM public.extraction_usage_monthly
  WHERE user_id = p_user_id AND year_month = v_ym
  FOR UPDATE;

  IF NOT FOUND OR v_count IS NULL OR v_count < 1 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.extraction_usage_monthly
  SET count = count - 1
  WHERE user_id = p_user_id AND year_month = v_ym;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_extraction_quota(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_extraction_quota(TEXT) TO service_role;
