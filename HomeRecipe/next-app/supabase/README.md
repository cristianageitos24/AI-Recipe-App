# Supabase setup

This app uses **Clerk** for authentication and **Supabase** for the database. Clerk **session tokens** are passed to Supabase via Third-Party Auth for RLS (Row Level Security).

For the full auth/cookie model, login/logout, protected routes, and security notes, see **[AUTHENTICATION.md](../AUTHENTICATION.md)** in `next-app`.

## First-time database sync

From the **`next-app`** directory (with Supabase CLI installed and project linked, or using Cursor’s Supabase MCP):

1. **`supabase db push`** (or **`npm run db:push`** from `next-app`) — applies every file in `supabase/migrations/` that is not yet recorded on the remote project, or use MCP **`list_migrations`** / **`apply_migration`** to stay aligned with the repo.
2. Prefer **not** pasting migration bodies into the Dashboard SQL Editor for routine deploys (ordering and parity are easier to verify from git).

## Setup

1. **Connect Clerk to Supabase (Third-Party Auth — required):**
   - In Clerk Dashboard → [Supabase integration](https://dashboard.clerk.com/setup/supabase) → **Activate** (adds `role: "authenticated"` to session tokens) → copy your **Clerk domain**.
   - In Supabase Dashboard → **Authentication** → [Third-party auth](https://supabase.com/dashboard/project/_/auth/third-party) → **Add provider** → **Clerk** → paste the Clerk domain.
   - Local stacks: `supabase/config.toml` already enables `[auth.third_party.clerk]` with this project’s Clerk domain.
   - App code uses `(await auth()).getToken()` (session token) in `utils/supabase/server.ts` — **not** JWT templates.
   - If inserts fail with **“new row violates row-level security policy”**, confirm Third-Party Auth is enabled and the Clerk domain matches. Do not add Supabase Auth session cookies or revive JWT templates.

2. **Migrations** — **40** numbered files under `supabase/migrations/` (there is **no** `021_*`; the sequence jumps from `020_*` to `022_*`). They are the source of truth: FDC nutrition (`026+`), grocery tables (`027`), comments (`028`), `fdc_candidates` (`029`), legacy **`ingredients` removal (`030`)**, archive/alignment (`031`–`033`), FDC hourly quota (`034`–`035`), grocery item category (`036`), folder cover image URL (`037`), soft delete columns (`038`), trash purge + cron (`039`), **`040` drops `legacy_recipes_archive` after offline export**, and **`041` hardens `get_random_recipes`**. Apply via CLI or MCP as above. The SQL Editor is for one-off debugging only.

   Early files include: `001_initial_schema.sql` (base tables), `002_clerk_schema.sql`, `003_add_recipe_steps.sql`, `004_drop_django_legacy_tables.sql`, `005_enable_rls_on_app_tables.sql`, `006_drop_user_recipes.sql`, `007_ingredients_table.sql`, `008_recipes_search_indexes.sql`. Newer migrations extend the schema further; always apply the full chain on a fresh database.

3. **Verify sync** — With the project linked, run `npm run db:migrations` (or `supabase migration list`) and confirm every local file is marked applied on the remote. Quick schema checks after `038`/`039`:

   ```sql
   SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name IN ('folders','recipes') AND column_name = 'deleted_at';
   SELECT routine_name FROM information_schema.routines
     WHERE routine_schema = 'public' AND routine_name = 'purge_trashed_rows';
   SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'purge_trashed_rows_daily';
   ```

4. **Trash purge (`038` + `039`)** — `038_soft_delete_trash.sql` adds `deleted_at` on `folders` and `recipes`. `039_trash_purge_cron.sql` defines `public.purge_trashed_rows()` and schedules it with **`pg_cron`** daily at **03:15 UTC** as job `purge_trashed_rows_daily`. Use the queries in §3 to confirm.

## Archive + wipe notes

- `031_legacy_recipes_archive.sql` creates `public.legacy_recipes_archive` with RLS enabled and no `authenticated` read/write access.
- `032_backfill_legacy_recipes_archive.sql` snapshots every row in `recipes` + `recipe_nutrition` + `recipe_ingredient_lines` into JSONB and fails the migration if verification mismatches.
- `033_cross_table_alignment_indexes.sql` adds additive indexes for recipe-centric lookups in junction tables.
- The destructive wipe is intentionally a manual ops step: run `supabase/ops/archive_verify_and_wipe_recipes.sql` as database owner/service role after backups and archive verification.
- After the wipe, the archive was exported offline (`npm run export:legacy-archive` → `supabase/exports/*.ndjson.gz`, gitignored) and removed with `040_drop_legacy_recipes_archive.sql`. Restore with `npm run restore:legacy-archive -- --file <path>` after recreating the `031` table DDL if needed.
