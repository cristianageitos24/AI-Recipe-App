-- Migration: Add source metadata to video_processing_jobs for URL-based jobs

ALTER TABLE public.video_processing_jobs
ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'upload' CHECK (source_type IN ('upload', 'url')),
ADD COLUMN IF NOT EXISTS source_url TEXT,
ADD COLUMN IF NOT EXISTS source_platform TEXT,
ADD COLUMN IF NOT EXISTS video_deleted_at TIMESTAMPTZ;

