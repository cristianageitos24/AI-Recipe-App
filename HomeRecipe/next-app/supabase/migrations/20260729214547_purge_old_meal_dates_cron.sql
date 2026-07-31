-- Hard-delete meal calendar entries older than 90 days.
-- meal_date_recipes cascade via FK ON DELETE CASCADE.
-- Requires pg_cron on hosted Supabase; if unavailable locally, apply via Dashboard SQL.
-- Retention must stay aligned with lib/meal-calendar-retention.ts and getMealDates() lookback.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.purge_old_meal_dates()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.meal_dates
  WHERE date < (CURRENT_DATE - INTERVAL '90 days');
$$;

REVOKE ALL ON FUNCTION public.purge_old_meal_dates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_old_meal_dates() TO postgres;

SELECT cron.schedule(
  'purge_old_meal_dates_daily',
  '30 3 * * *',
  $$SELECT public.purge_old_meal_dates();$$
);
