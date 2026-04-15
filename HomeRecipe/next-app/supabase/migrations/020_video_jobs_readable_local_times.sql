-- Human-readable timestamps for tools that display timestamptz in UTC by default.
-- Open **video_processing_jobs_readable** in the Table Editor; use *_us_central columns
-- for America/Chicago wall time. Base table columns are unchanged (still correct UTC instants).
-- Security: see 022_video_jobs_readable_security_invoker.sql (security_invoker).

CREATE OR REPLACE VIEW public.video_processing_jobs_readable AS
SELECT
  j.*,
  timezone('America/Chicago', j.created_at) AS created_at_us_central,
  timezone('America/Chicago', j.updated_at) AS updated_at_us_central,
  timezone('America/Chicago', j.started_at) AS started_at_us_central,
  timezone('America/Chicago', j.finished_at) AS finished_at_us_central,
  timezone('America/Chicago', j.locked_at) AS locked_at_us_central
FROM public.video_processing_jobs j;

COMMENT ON VIEW public.video_processing_jobs_readable IS
  'video_processing_jobs plus *_us_central timestamp columns (no tz; wall clock in America/Chicago). Underlying table still stores timestamptz in UTC.';

GRANT SELECT ON public.video_processing_jobs_readable TO authenticated;
GRANT SELECT ON public.video_processing_jobs_readable TO service_role;
