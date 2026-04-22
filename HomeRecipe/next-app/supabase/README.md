# Supabase setup

This app uses **Clerk** for authentication and **Supabase** for the database. Clerk session tokens are passed to Supabase for RLS (Row Level Security).

## First-time database sync

From the **`next-app`** directory (with Supabase CLI installed and project linked, or using Cursor’s Supabase MCP):

1. **`supabase db push`** — applies every file in `supabase/migrations/` that is not yet recorded on the remote project, or use MCP **`list_migrations`** / **`apply_migration`** to stay aligned with the repo.
2. Prefer **not** pasting migration bodies into the Dashboard SQL Editor for routine deploys (ordering and parity are easier to verify from git).

## Setup

1. **Enable Clerk as third-party auth in Supabase:**
   - In Clerk Dashboard → [Supabase integration](https://dashboard.clerk.com/setup/supabase) → Activate and copy your Clerk domain.
   - In Supabase Dashboard → **Authentication** → **Sign In / Up** → **Add provider** → **Clerk** → Paste the Clerk domain.

2. **Migrations** — numbered files under `supabase/migrations/` are the source of truth, including FDC nutrition (`026+`), grocery (`027`), comments (`028`), `fdc_candidates` (`029`), legacy **`ingredients` removal (`030`)**, and archive/alignment files (`031`-`033`). Apply via CLI or MCP as above. The SQL Editor is for one-off debugging only.

   Early files include: `001_initial_schema.sql` (base tables), `002_clerk_schema.sql`, `003_add_recipe_steps.sql`, `004_drop_django_legacy_tables.sql`, `005_enable_rls_on_app_tables.sql`, `006_drop_user_recipes.sql`, `007_ingredients_table.sql`, `008_recipes_search_indexes.sql`. Newer migrations extend the schema further; always apply the full chain on a fresh database.

## Archive + wipe notes

- `031_legacy_recipes_archive.sql` creates `public.legacy_recipes_archive` with RLS enabled and no `authenticated` read/write access.
- `032_backfill_legacy_recipes_archive.sql` snapshots every row in `recipes` + `recipe_nutrition` + `recipe_ingredient_lines` into JSONB and fails the migration if verification mismatches.
- `033_cross_table_alignment_indexes.sql` adds additive indexes for recipe-centric lookups in junction tables.
- The destructive wipe is intentionally a manual ops step: run `supabase/ops/archive_verify_and_wipe_recipes.sql` as database owner/service role after backups and archive verification.
