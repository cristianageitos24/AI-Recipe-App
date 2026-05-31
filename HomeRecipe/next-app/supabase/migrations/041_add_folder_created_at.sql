-- Track cookbook creation time for folder detail metadata.

ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN public.folders.created_at IS 'Timestamp when the cookbook folder was created.';
