-- GIN trigram indexes for fast ilike on recipes; RPC for random suggested recipes
-- Run after 007_ingredients_table.sql (pg_trgm already enabled there)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Indexes so ilike('%...%') on recipe_label and ingredient_lines use the index
CREATE INDEX idx_recipes_recipe_label_trgm ON public.recipes USING gin(recipe_label gin_trgm_ops);
CREATE INDEX idx_recipes_ingredient_lines_trgm ON public.recipes USING gin(ingredient_lines gin_trgm_ops);

-- RPC: return 12 random recipes in one request (replaces fetching 100 then filtering in JS)
CREATE OR REPLACE FUNCTION public.get_random_recipes(p_limit int DEFAULT 12)
RETURNS SETOF public.recipes
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM public.recipes ORDER BY random() LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_random_recipes(int) IS 'Returns up to p_limit random recipes for Recommended section; used by authenticated client.';

GRANT EXECUTE ON FUNCTION public.get_random_recipes(int) TO authenticated;
