-- Ingredients table for autocomplete (extracted from Open Recipes)
-- Run after 006_drop_user_recipes.sql. Idempotent: safe to run if table already exists.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  search_name TEXT NOT NULL,
  use_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ingredients_search ON public.ingredients USING gin(search_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ingredients_use_count ON public.ingredients(use_count DESC);

COMMENT ON TABLE public.ingredients IS 'Canonical ingredient names for search autocomplete, extracted from Open Recipes';

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read ingredients" ON public.ingredients;
CREATE POLICY "Authenticated can read ingredients" ON public.ingredients
  FOR SELECT TO authenticated USING (true);
