# Local archive exports (not committed — large binary dumps)

Gzipped NDJSON dumps of `public.legacy_recipes_archive`.

- **Format:** one JSON object per line (not Excel). Each object is a full archive row: `id`, `original_recipe_uuid`, `archived_at`, `archive_batch_id`, `note`, `snapshot`.
- **Export:** `npx tsx scripts/export-legacy-recipes-archive.ts`
- **Restore:** `npx tsx scripts/restore-legacy-recipes-archive.ts --file supabase/exports/<file>.ndjson.gz`  
  (table must exist first — re-apply migration `031` DDL if it was dropped.)

Keep these files somewhere safe (disk / Drive / backup). They are gitignored.
