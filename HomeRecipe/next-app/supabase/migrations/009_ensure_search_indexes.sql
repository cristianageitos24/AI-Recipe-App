-- Ensure GIN trigram indexes exist for fast recipe/ingredient search (idempotent).
-- Run after 008_recipes_search_indexes.sql. Safe if 008 already created the indexes.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_recipes_recipe_label_trgm
  ON public.recipes USING gin(recipe_label gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_recipes_ingredient_lines_trgm
  ON public.recipes USING gin(ingredient_lines gin_trgm_ops);
