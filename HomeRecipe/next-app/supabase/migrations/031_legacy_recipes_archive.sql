-- Archive table for pre-wipe recipe snapshots (recipes + nutrition + ingredient lines).
-- Runtime app paths must not read this table; this is operational/admin only.

CREATE TABLE IF NOT EXISTS public.legacy_recipes_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_recipe_uuid UUID NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archive_batch_id UUID,
  note TEXT,
  snapshot JSONB NOT NULL,
  CONSTRAINT legacy_recipes_archive_original_recipe_uuid_unique UNIQUE (original_recipe_uuid)
);

CREATE INDEX IF NOT EXISTS idx_legacy_recipes_archive_archived_at
  ON public.legacy_recipes_archive (archived_at);

COMMENT ON TABLE public.legacy_recipes_archive IS
  'Operational archive snapshots for recipes before destructive wipes. Not part of runtime reads.';
COMMENT ON COLUMN public.legacy_recipes_archive.original_recipe_uuid IS
  'Original public.recipes.id value at archive time.';
COMMENT ON COLUMN public.legacy_recipes_archive.archive_batch_id IS
  'Optional run-level UUID to group one archive batch.';
COMMENT ON COLUMN public.legacy_recipes_archive.snapshot IS
  'JSON snapshot: { recipe, recipe_nutrition, recipe_ingredient_lines[] }.';

-- Match hardening approach used by fdc_* and fdc_api_cache.
ALTER TABLE public.legacy_recipes_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legacy_recipes_archive FROM anon, authenticated;
