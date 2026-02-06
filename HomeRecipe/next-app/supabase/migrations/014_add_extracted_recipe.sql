-- Migration: Add extracted_recipe JSONB to video_processing_jobs
-- Stores structured recipe extracted by AI reasoning (title, ingredients, steps, etc.)

ALTER TABLE public.video_processing_jobs
ADD COLUMN IF NOT EXISTS extracted_recipe JSONB NULL;
