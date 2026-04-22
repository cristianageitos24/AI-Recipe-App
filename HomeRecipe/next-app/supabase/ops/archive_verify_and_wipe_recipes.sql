-- Runbook SQL for Phases 2, 4, and 5 of archive + wipe.
-- Run as database owner or service role in a controlled window.
-- This script is intentionally NOT in numbered migrations because it is destructive.

BEGIN;

-- ---------------------------------------------------------------------------
-- Phase 2 verification (pre-wipe)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  live_count BIGINT;
  archived_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO live_count FROM public.recipes;
  SELECT COUNT(*) INTO archived_count FROM public.legacy_recipes_archive;

  IF archived_count <> live_count THEN
    RAISE EXCEPTION
      'Abort wipe: archive count (%) must equal live recipe count (%)',
      archived_count,
      live_count;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Phase 4 wipe (full reset: shared + user-owned)
-- ---------------------------------------------------------------------------
DELETE FROM public.recipes;

-- ---------------------------------------------------------------------------
-- Phase 5 post-wipe verification
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  recipes_count BIGINT;
  lines_count BIGINT;
  nutrition_count BIGINT;
  favorites_count BIGINT;
  folder_recipes_count BIGINT;
  meal_links_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO recipes_count FROM public.recipes;
  SELECT COUNT(*) INTO lines_count FROM public.recipe_ingredient_lines;
  SELECT COUNT(*) INTO nutrition_count FROM public.recipe_nutrition;
  SELECT COUNT(*) INTO favorites_count FROM public.favorites;
  SELECT COUNT(*) INTO folder_recipes_count FROM public.folder_recipes;
  SELECT COUNT(*) INTO meal_links_count FROM public.meal_date_recipes;

  IF recipes_count <> 0
    OR lines_count <> 0
    OR nutrition_count <> 0
    OR favorites_count <> 0
    OR folder_recipes_count <> 0
    OR meal_links_count <> 0 THEN
    RAISE EXCEPTION
      'Post-wipe verification failed (recipes %, lines %, nutrition %, favorites %, folder_recipes %, meal_date_recipes %)',
      recipes_count,
      lines_count,
      nutrition_count,
      favorites_count,
      folder_recipes_count,
      meal_links_count;
  END IF;
END
$$;

COMMIT;

-- Optional read-only checks:
-- SELECT COUNT(*) FROM public.fdc_foods;
-- SELECT COUNT(*) FROM public.fdc_nutrients;
-- SELECT COUNT(*) FROM public.fdc_food_portions;
-- SELECT COUNT(*) FROM public.fdc_api_cache;
