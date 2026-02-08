# Supabase Storage Setup for Video Uploads

## Manual Setup (Recommended)

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `videos`
4. Set to **Private** (not public)
5. Click "Create bucket"

## Storage RLS Policies

After creating the bucket, run these policies in the Supabase SQL Editor:

```sql
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
```

## Automated Setup Script

Alternatively, run the setup script:

```bash
npm run setup:storage
```

This requires `SUPABASE_SECRET_KEY` in your `.env.local` file.
