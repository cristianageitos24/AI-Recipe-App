-- Storage RLS Policies for Videos Bucket
-- Run this AFTER creating the 'videos' bucket in Supabase Dashboard → Storage
-- 
-- To create the bucket manually:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "New bucket"
-- 3. Name: videos
-- 4. Set to Private (not public)
-- 5. Click "Create bucket"

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can upload own videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own videos" ON storage.objects;

-- Allow users to upload videos to their own folder
CREATE POLICY "Users can upload own videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'videos' 
  AND (storage.foldername(name))[1] = auth.jwt()->>'sub'
);

-- Allow users to read their own videos
CREATE POLICY "Users can read own videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'videos' 
  AND (storage.foldername(name))[1] = auth.jwt()->>'sub'
);

-- Allow users to delete their own videos
CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos' 
  AND (storage.foldername(name))[1] = auth.jwt()->>'sub'
);
