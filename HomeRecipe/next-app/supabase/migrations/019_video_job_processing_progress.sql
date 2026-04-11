-- Real-time progress for video_processing_jobs (worker writes; client polls)

ALTER TABLE public.video_processing_jobs
  ADD COLUMN IF NOT EXISTS processing_progress SMALLINT NOT NULL DEFAULT 0
    CHECK (processing_progress >= 0 AND processing_progress <= 100),
  ADD COLUMN IF NOT EXISTS processing_stage TEXT,
  ADD COLUMN IF NOT EXISTS processing_detail TEXT;

COMMENT ON COLUMN public.video_processing_jobs.processing_progress IS '0-100 determinate progress for UI';
COMMENT ON COLUMN public.video_processing_jobs.processing_stage IS 'Machine stage id: downloading, validating, thumbnail, transcription, ocr, reasoning, finalizing, complete, error';
COMMENT ON COLUMN public.video_processing_jobs.processing_detail IS 'Optional subtext e.g. frame counts';

-- Reset progress when a worker claims a job (avoids stale % after crash)
CREATE OR REPLACE FUNCTION claim_video_job(worker_id TEXT)
RETURNS TABLE (
  id UUID,
  user_id TEXT,
  status TEXT,
  video_url TEXT,
  tiktok_url TEXT,
  attempts INT,
  locked_at TIMESTAMPTZ
) AS $$
DECLARE
  claimed_job RECORD;
BEGIN
  UPDATE public.video_processing_jobs AS vpj
  SET
    status = 'processing',
    locked_at = NOW(),
    locked_by = worker_id,
    attempts = vpj.attempts + 1,
    started_at = NOW(),
    updated_at = NOW(),
    processing_progress = 0,
    processing_stage = NULL,
    processing_detail = NULL
  WHERE vpj.id = (
    SELECT v2.id FROM public.video_processing_jobs v2
    WHERE v2.status = 'uploaded'
      AND (v2.locked_at IS NULL OR v2.locked_at < NOW() - INTERVAL '10 minutes')
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
      claimed_job.locked_at;
  END IF;
END;
$$ LANGUAGE plpgsql;
