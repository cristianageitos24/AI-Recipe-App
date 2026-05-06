-- Optional hero image for cookbook cards; null = use built-in default from static assets.

ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

COMMENT ON COLUMN public.folders.cover_image_url IS 'Public URL for cookbook card cover; when null, UI picks a deterministic default image from /public.';
