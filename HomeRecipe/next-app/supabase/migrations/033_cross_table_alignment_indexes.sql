-- Phase 3a: additive/index-only alignment for common cross-table lookups.
-- Safe on populated tables; no destructive DDL here.

-- Junctions frequently filter by recipe_id when rendering folder/favorite/meal relations.
CREATE INDEX IF NOT EXISTS idx_folder_recipes_recipe_id
  ON public.folder_recipes (recipe_id);

CREATE INDEX IF NOT EXISTS idx_favorites_recipe_id
  ON public.favorites (recipe_id);

CREATE INDEX IF NOT EXISTS idx_meal_date_recipes_recipe_id
  ON public.meal_date_recipes (recipe_id);

COMMENT ON INDEX public.idx_folder_recipes_recipe_id IS
  'Supports recipe-centric folder lookups and cascade verification checks.';
COMMENT ON INDEX public.idx_favorites_recipe_id IS
  'Supports recipe-centric favorite lookups and cascade verification checks.';
COMMENT ON INDEX public.idx_meal_date_recipes_recipe_id IS
  'Supports recipe-centric meal link lookups and cascade verification checks.';
