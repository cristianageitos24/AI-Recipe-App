-- Soft-delete for cookbooks and user-owned recipes; purged after retention window by cron.

ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.recipes
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.folders.deleted_at IS 'When set, folder is in trash until purge job hard-deletes.';
COMMENT ON COLUMN public.recipes.deleted_at IS 'When set, recipe is in trash until purge job hard-deletes.';

CREATE INDEX IF NOT EXISTS idx_folders_deleted_at ON public.folders (deleted_at)
WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recipes_deleted_at ON public.recipes (deleted_at)
WHERE deleted_at IS NOT NULL;
