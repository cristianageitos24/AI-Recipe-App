-- USDA FoodData Central reference tables (public.fdc_*), recipe ingredient lines,
-- and recipe-level nutrition snapshots. Server-side access for bulk fdc_* data (see REVOKE below).
-- recipe_nutrition is the long-term home for kcal/macros; recipes.calories remains for app compatibility until a later cutover.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- FDC import bookkeeping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fdc_import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  fdc_release_label TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  row_counts JSONB,
  checksum TEXT
);

COMMENT ON TABLE public.fdc_import_runs IS 'Idempotent ETL bookkeeping for USDA FDC CSV/API loads';

-- ---------------------------------------------------------------------------
-- Core FDC reference
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fdc_nutrient_defs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  unit_name TEXT,
  nutrient_nbr TEXT,
  rank REAL
);

CREATE TABLE IF NOT EXISTS public.fdc_measure_units (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fdc_food_categories (
  id INTEGER PRIMARY KEY,
  code TEXT,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fdc_foods (
  fdc_id INTEGER PRIMARY KEY,
  data_type TEXT NOT NULL,
  description TEXT NOT NULL,
  food_category_id INTEGER REFERENCES public.fdc_food_categories (id),
  publication_date DATE,
  ndb_number TEXT,
  footnote TEXT,
  brand_owner TEXT,
  gtin_upc TEXT
);

CREATE INDEX IF NOT EXISTS idx_fdc_foods_data_type ON public.fdc_foods (data_type);
CREATE INDEX IF NOT EXISTS idx_fdc_foods_description_lower ON public.fdc_foods (LOWER(description));
CREATE INDEX IF NOT EXISTS idx_fdc_foods_description_trgm ON public.fdc_foods USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_fdc_foods_gtin_upc ON public.fdc_foods (gtin_upc) WHERE gtin_upc IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.fdc_nutrients (
  food_nutrient_id BIGINT PRIMARY KEY,
  fdc_id INTEGER NOT NULL REFERENCES public.fdc_foods (fdc_id) ON DELETE CASCADE,
  nutrient_id INTEGER NOT NULL REFERENCES public.fdc_nutrient_defs (id),
  amount REAL NOT NULL,
  data_points INTEGER,
  derivation_id INTEGER,
  min_val REAL,
  max_val REAL,
  median_val REAL,
  footnote TEXT,
  min_year_acquired INTEGER
);

CREATE INDEX IF NOT EXISTS idx_fdc_nutrients_fdc_id ON public.fdc_nutrients (fdc_id);
CREATE INDEX IF NOT EXISTS idx_fdc_nutrients_nutrient_id ON public.fdc_nutrients (nutrient_id);

CREATE TABLE IF NOT EXISTS public.fdc_food_portions (
  id BIGINT PRIMARY KEY,
  fdc_id INTEGER NOT NULL REFERENCES public.fdc_foods (fdc_id) ON DELETE CASCADE,
  seq_num INTEGER,
  amount REAL,
  measure_unit_id INTEGER REFERENCES public.fdc_measure_units (id),
  portion_description TEXT,
  modifier TEXT,
  gram_weight REAL,
  data_points INTEGER,
  footnote TEXT,
  min_year_acquired INTEGER
);

CREATE INDEX IF NOT EXISTS idx_fdc_food_portions_fdc_id ON public.fdc_food_portions (fdc_id);

-- ---------------------------------------------------------------------------
-- Runtime API cache (server-side only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fdc_api_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_normalized TEXT NOT NULL,
  data_type_filter TEXT,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (query_normalized, data_type_filter)
);

CREATE INDEX IF NOT EXISTS idx_fdc_api_cache_fetched_at ON public.fdc_api_cache (fetched_at);

COMMENT ON TABLE public.fdc_api_cache IS 'Server-only cache for FDC /foods/search and /food/{id} responses';

-- ---------------------------------------------------------------------------
-- Recipe ingredient lines + nutrition (1:1 nutrition per recipe)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipe_ingredient_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.recipes (id) ON DELETE CASCADE,
  line_index INTEGER NOT NULL,
  raw_text TEXT,
  quantity NUMERIC(20, 8),
  unit TEXT,
  item TEXT,
  notes TEXT,
  fdc_id INTEGER REFERENCES public.fdc_foods (fdc_id) ON DELETE SET NULL,
  fdc_match_score REAL,
  line_nutrition_source TEXT NOT NULL DEFAULT 'unresolved'
    CHECK (line_nutrition_source IN ('fdc', 'estimated', 'unresolved')),
  grams NUMERIC(20, 8),
  ml NUMERIC(20, 8),
  estimation_reason TEXT,
  UNIQUE (recipe_id, line_index)
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_lines_recipe_id ON public.recipe_ingredient_lines (recipe_id);

CREATE TABLE IF NOT EXISTS public.recipe_nutrition (
  recipe_id UUID PRIMARY KEY REFERENCES public.recipes (id) ON DELETE CASCADE,
  energy_kcal NUMERIC(12, 4) NOT NULL DEFAULT 0,
  protein_g NUMERIC(12, 4) NOT NULL DEFAULT 0,
  fat_g NUMERIC(12, 4) NOT NULL DEFAULT 0,
  carb_g NUMERIC(12, 4) NOT NULL DEFAULT 0,
  nutrition_source TEXT NOT NULL DEFAULT 'incomplete'
    CHECK (nutrition_source IN ('fdc', 'estimated', 'mixed', 'incomplete')),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fdc_release_label TEXT,
  servings NUMERIC(10, 2)
);

COMMENT ON TABLE public.recipe_nutrition IS 'Persisted nutrition snapshot; prefer over recipes.calories once app is migrated';
COMMENT ON COLUMN public.recipes.calories IS 'Legacy display kcal; canonical totals live in recipe_nutrition.energy_kcal';

-- Backfill from legacy calories (unknown macros → incomplete)
INSERT INTO public.recipe_nutrition (
  recipe_id,
  energy_kcal,
  protein_g,
  fat_g,
  carb_g,
  nutrition_source,
  computed_at
)
SELECT
  id,
  calories::NUMERIC(12, 4),
  0,
  0,
  0,
  'incomplete',
  NOW()
FROM public.recipes
ON CONFLICT (recipe_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS: fdc_* and fdc_api_cache — enabled, no policies → only service_role (bypass) for writes/reads from PostgREST clients
-- ---------------------------------------------------------------------------
ALTER TABLE public.fdc_import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fdc_nutrient_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fdc_measure_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fdc_food_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fdc_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fdc_nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fdc_food_portions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fdc_api_cache ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recipe_ingredient_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_nutrition ENABLE ROW LEVEL SECURITY;

-- recipe_ingredient_lines: read like recipes; mutate only on user-owned recipes
CREATE POLICY "recipe_ingredient_lines_select" ON public.recipe_ingredient_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.recipes r
      WHERE r.id = recipe_ingredient_lines.recipe_id
        AND ((r.user_id IS NULL) OR (r.user_id = (auth.jwt() ->> 'sub')))
    )
  );

CREATE POLICY "recipe_ingredient_lines_mutate" ON public.recipe_ingredient_lines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.recipes r
      WHERE r.id = recipe_ingredient_lines.recipe_id
        AND r.user_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.recipes r
      WHERE r.id = recipe_ingredient_lines.recipe_id
        AND r.user_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "recipe_nutrition_select" ON public.recipe_nutrition
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.recipes r
      WHERE r.id = recipe_nutrition.recipe_id
        AND ((r.user_id IS NULL) OR (r.user_id = (auth.jwt() ->> 'sub')))
    )
  );

CREATE POLICY "recipe_nutrition_mutate" ON public.recipe_nutrition
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.recipes r
      WHERE r.id = recipe_nutrition.recipe_id
        AND r.user_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.recipes r
      WHERE r.id = recipe_nutrition.recipe_id
        AND r.user_id = (auth.jwt() ->> 'sub')
    )
  );

-- ---------------------------------------------------------------------------
-- Revoke broad access to bulk FDC tables from API roles (server uses service role)
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.fdc_import_runs FROM anon, authenticated;
REVOKE ALL ON public.fdc_nutrient_defs FROM anon, authenticated;
REVOKE ALL ON public.fdc_measure_units FROM anon, authenticated;
REVOKE ALL ON public.fdc_food_categories FROM anon, authenticated;
REVOKE ALL ON public.fdc_foods FROM anon, authenticated;
REVOKE ALL ON public.fdc_nutrients FROM anon, authenticated;
REVOKE ALL ON public.fdc_food_portions FROM anon, authenticated;
REVOKE ALL ON public.fdc_api_cache FROM anon, authenticated;
