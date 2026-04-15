-- Optional structured metrics from vision pipeline (blur/skip/OCR timings)

ALTER TABLE public.video_processing_jobs
  ADD COLUMN IF NOT EXISTS vision_metrics JSONB DEFAULT NULL;

COMMENT ON COLUMN public.video_processing_jobs.vision_metrics IS
  'Worker-populated JSON: frames_extracted, frames_ocrd, vision_engine, vision_ms, ocr_ms, would_skip_blur, etc.';
