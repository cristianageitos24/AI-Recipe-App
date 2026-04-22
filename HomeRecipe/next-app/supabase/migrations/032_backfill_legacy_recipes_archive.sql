-- Backfill recipe snapshots into legacy_recipes_archive before any destructive wipe.
-- Includes a strict verification gate so migration halts on mismatch.

WITH archive_batch AS (
  SELECT gen_random_uuid() AS batch_id
)
INSERT INTO public.legacy_recipes_archive (
  original_recipe_uuid,
  archive_batch_id,
  snapshot
)
SELECT
  r.id AS original_recipe_uuid,
  b.batch_id AS archive_batch_id,
  jsonb_build_object(
    'recipe', to_jsonb(r),
    'recipe_nutrition', (
      SELECT to_jsonb(n)
      FROM public.recipe_nutrition n
      WHERE n.recipe_id = r.id
      LIMIT 1
    ),
    'recipe_ingredient_lines', COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(l) ORDER BY l.line_index)
        FROM public.recipe_ingredient_lines l
        WHERE l.recipe_id = r.id
      ),
      '[]'::jsonb
    )
  ) AS snapshot
FROM public.recipes r
CROSS JOIN archive_batch b
ON CONFLICT (original_recipe_uuid) DO UPDATE
SET
  archive_batch_id = EXCLUDED.archive_batch_id,
  snapshot = EXCLUDED.snapshot,
  archived_at = NOW(),
  note = COALESCE(public.legacy_recipes_archive.note, 'refreshed during migration 032');

DO $$
DECLARE
  live_count BIGINT;
  archived_count BIGINT;
  bad_snapshot_id_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO live_count FROM public.recipes;
  SELECT COUNT(*) INTO archived_count FROM public.legacy_recipes_archive;

  IF archived_count <> live_count THEN
    RAISE EXCEPTION
      'legacy_recipes_archive verification failed: recipes=% archive=%',
      live_count,
      archived_count;
  END IF;

  SELECT COUNT(*)
  INTO bad_snapshot_id_count
  FROM public.legacy_recipes_archive a
  WHERE (a.snapshot -> 'recipe' ->> 'id') IS DISTINCT FROM a.original_recipe_uuid::text;

  IF bad_snapshot_id_count > 0 THEN
    RAISE EXCEPTION
      'legacy_recipes_archive verification failed: % snapshots do not match original_recipe_uuid',
      bad_snapshot_id_count;
  END IF;
END
$$;
