-- Add thumbnail_url to video_processing_jobs for recipe card default image (frame at ~1s)
ALTER TABLE public.video_processing_jobs
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT NULL;
