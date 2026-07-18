-- Drop operational pre-wipe archive after offline export.
-- Backup: supabase/exports/legacy_recipes_archive_*.ndjson.gz (local, gitignored)
-- Restore: npm run restore:legacy-archive -- --file <path>
-- (re-create table via 031 DDL first if needed)

DROP TABLE IF EXISTS public.legacy_recipes_archive;
