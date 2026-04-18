-- Optional JSON array of plausible FDC matches when resolution is ambiguous (user must pick).
ALTER TABLE public.recipe_ingredient_lines
  ADD COLUMN IF NOT EXISTS fdc_candidates JSONB;

COMMENT ON COLUMN public.recipe_ingredient_lines.fdc_candidates IS
  'Array of { fdc_id, description, score } when multiple plausible USDA foods matched; cleared after user picks or re-sync resolves uniquely.';
