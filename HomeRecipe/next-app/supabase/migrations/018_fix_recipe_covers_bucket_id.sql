-- Normalize recipe-covers bucket so id and name are both 'recipe-covers'
-- and ensure any existing objects are pointed at the correct bucket.
-- This migration is safe to run multiple times.

DO $$
DECLARE
  v_old_id text;
BEGIN
  -- Case 1: a recipe-covers bucket exists with a non-standard id (e.g. UUID)
  SELECT id
  INTO v_old_id
  FROM storage.buckets
  WHERE name = 'recipe-covers'
    AND id <> 'recipe-covers'
  LIMIT 1;

  IF v_old_id IS NOT NULL THEN
    -- Ensure a bucket row with id = 'recipe-covers' exists or normalize the existing one
    IF EXISTS (
      SELECT 1
      FROM storage.buckets
      WHERE id = 'recipe-covers'
    ) THEN
      UPDATE storage.buckets
      SET name = 'recipe-covers',
          public = true
      WHERE id = 'recipe-covers';
    ELSE
      UPDATE storage.buckets
      SET id = 'recipe-covers',
          name = 'recipe-covers',
          public = true
      WHERE id = v_old_id;
      -- v_old_id is now out of date after the UPDATE; keep it only for reference in comments.
    END IF;

    -- Re-point any existing objects to the normalized bucket id
    UPDATE storage.objects
    SET bucket_id = 'recipe-covers'
    WHERE bucket_id = v_old_id;

  ELSIF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'recipe-covers'
       OR name = 'recipe-covers'
  ) THEN
    -- Case 2: no recipe-covers bucket at all (fresh environment)
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('recipe-covers', 'recipe-covers', true);
  ELSE
    -- Case 3: bucket already has the correct id or name; just normalize name/public flag
    UPDATE storage.buckets
    SET name = 'recipe-covers',
        public = true
    WHERE id = 'recipe-covers'
       OR name = 'recipe-covers';
  END IF;
END $$;

