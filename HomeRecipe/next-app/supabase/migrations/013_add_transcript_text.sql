-- Migration: Add transcript_text column to video_processing_jobs
-- Stores speech-to-text transcription from video audio

ALTER TABLE public.video_processing_jobs
ADD COLUMN IF NOT EXISTS transcript_text TEXT NULL;
