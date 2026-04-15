-- Worker-only RPC to update job progress (service_role). Avoids PostgREST/RLS quirks on direct PATCH.

CREATE OR REPLACE FUNCTION public.worker_update_video_job_progress(
  p_job_id uuid,
  p_progress smallint,
  p_stage text,
  p_detail text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  IF p_progress IS NULL OR p_progress < 0 OR p_progress > 100 THEN
    RAISE EXCEPTION 'invalid progress %', p_progress;
  END IF;

  UPDATE public.video_processing_jobs
  SET
    processing_progress = p_progress,
    processing_stage = p_stage,
    processing_detail = p_detail
  WHERE id = p_job_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.worker_update_video_job_progress(uuid, smallint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_update_video_job_progress(uuid, smallint, text, text) TO service_role;

COMMENT ON FUNCTION public.worker_update_video_job_progress IS
  'Video worker (service_role only): set processing_progress / stage / detail.';
