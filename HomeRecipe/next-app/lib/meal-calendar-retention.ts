/**
 * Meal calendar retention window. Must stay aligned with `purge_old_meal_dates` in
 * supabase/migrations/20260729214547_purge_old_meal_dates_cron.sql (`interval '90 days'`).
 */
export const MEAL_CALENDAR_RETENTION_DAYS = 90;

/** How far ahead getMealDates() loads planned meals. */
export const MEAL_CALENDAR_LOOKAHEAD_MONTHS = 4;
