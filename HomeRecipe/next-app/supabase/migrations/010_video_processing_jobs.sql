-- Migration: Video Processing Jobs Table
-- Creates table for tracking video upload and OCR processing jobs
-- Includes job locking, retry logic, and observability fields

-- Create video_processing_jobs table
CREATE TABLE IF NOT EXISTS public.video_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'done', 'error')),
  video_url TEXT NOT NULL,
  tiktok_url TEXT,
  ocr_text TEXT,
  error_message TEXT,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  attempts INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  processing_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON public.video_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status_locked ON public.video_processing_jobs(status, locked_at);
CREATE INDEX IF NOT EXISTS idx_video_jobs_user_id ON public.video_processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_created_at ON public.video_processing_jobs(created_at);

-- Enable RLS
ALTER TABLE public.video_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own video jobs" ON public.video_processing_jobs;
DROP POLICY IF EXISTS "Users can create own video jobs" ON public.video_processing_jobs;
DROP POLICY IF EXISTS "Users can update own video jobs" ON public.video_processing_jobs;

-- RLS Policies
CREATE POLICY "Users can view own video jobs" ON public.video_processing_jobs
  FOR SELECT USING ((auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users can create own video jobs" ON public.video_processing_jobs
  FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users can update own video jobs" ON public.video_processing_jobs
  FOR UPDATE USING ((auth.jwt()->>'sub') = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_video_job_updated_at ON public.video_processing_jobs;
CREATE TRIGGER trigger_update_video_job_updated_at
  BEFORE UPDATE ON public.video_processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_video_job_updated_at();

-- Atomic job claiming function
-- Note: Use table aliases (vpj, v2) to avoid "column reference attempts is ambiguous"
-- when RETURNS TABLE includes attempts (PostgreSQL output param shadows table column)
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
    updated_at = NOW()
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
