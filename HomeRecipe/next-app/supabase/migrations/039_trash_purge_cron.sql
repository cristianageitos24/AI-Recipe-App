-- Hard-delete folders/recipes that have been soft-deleted for more than 7 days.
-- Requires pg_cron on hosted Supabase; if unavailable locally, apply via Dashboard SQL or use Edge Function fallback.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.purge_trashed_rows()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.folders
  WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '7 days';

  DELETE FROM public.recipes
  WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '7 days';
$$;

REVOKE ALL ON FUNCTION public.purge_trashed_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_trashed_rows() TO postgres;

SELECT cron.schedule(
  'purge_trashed_rows_daily',
  '15 3 * * *',
  $$SELECT public.purge_trashed_rows();$$
);
