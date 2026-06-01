-- Remove URL import scrape cache entries older than the application TTL.
-- The API also enforces this TTL at read time, so cleanup is best-effort storage hygiene.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.purge_expired_url_import_cache()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.url_import_cache
  WHERE cached_at < now() - interval '7 days';
$$;

REVOKE ALL ON FUNCTION public.purge_expired_url_import_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_url_import_cache() TO postgres;

SELECT cron.schedule(
  'purge_expired_url_import_cache_daily',
  '35 3 * * *',
  $$SELECT public.purge_expired_url_import_cache();$$
);
