-- Fix: use security_invoker so the view is not Security Definer / API-unrestricted.
-- Safe to run after 020 (or equivalent) created video_processing_jobs_readable.

DROP VIEW IF EXISTS public.video_processing_jobs_readable;

CREATE VIEW public.video_processing_jobs_readable
WITH (security_invoker = true)
AS
SELECT
  j.*,
  timezone('America/Chicago', j.created_at) AS created_at_us_central,
  timezone('America/Chicago', j.updated_at) AS updated_at_us_central,
  timezone('America/Chicago', j.started_at) AS started_at_us_central,
  timezone('America/Chicago', j.finished_at) AS finished_at_us_central,
  timezone('America/Chicago', j.locked_at) AS locked_at_us_central
FROM public.video_processing_jobs j;

COMMENT ON VIEW public.video_processing_jobs_readable IS
  'video_processing_jobs plus *_us_central (America/Chicago wall time). security_invoker: RLS on base table applies.';

GRANT SELECT ON public.video_processing_jobs_readable TO authenticated;
GRANT SELECT ON public.video_processing_jobs_readable TO service_role;
