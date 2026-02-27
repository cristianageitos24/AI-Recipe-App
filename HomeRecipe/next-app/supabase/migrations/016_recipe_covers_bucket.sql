-- Recipe covers bucket: public read for recipe card images (worker uploads with service role)
-- If storage.buckets doesn't exist or insert fails, create bucket in Dashboard → Storage → New bucket → name: recipe-covers, Public: true.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'recipe-covers') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES (gen_random_uuid(), 'recipe-covers', true);
  ELSE
    UPDATE storage.buckets SET public = true WHERE name = 'recipe-covers';
  END IF;
END $$;

-- Public read: anyone can view recipe cover images
DROP POLICY IF EXISTS "Public read recipe covers" ON storage.objects;
CREATE POLICY "Public read recipe covers"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'recipe-covers');

-- Authenticated users can upload to their own folder (user_id/job_id/...)
DROP POLICY IF EXISTS "Users can upload own recipe covers" ON storage.objects;
CREATE POLICY "Users can upload own recipe covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recipe-covers'
  AND (storage.foldername(name))[1] = auth.jwt()->>'sub'
);

-- Service role (worker) bypasses RLS; no policy needed for worker uploads.
