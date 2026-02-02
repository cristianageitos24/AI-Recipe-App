# Supabase setup

This app uses **Clerk** for authentication and **Supabase** for the database. Clerk session tokens are passed to Supabase for RLS (Row Level Security).

## Setup

1. **Enable Clerk as third-party auth in Supabase:**
   - In Clerk Dashboard → [Supabase integration](https://dashboard.clerk.com/setup/supabase) → Activate and copy your Clerk domain.
   - In Supabase Dashboard → **Authentication** → **Sign In / Up** → **Add provider** → **Clerk** → Paste the Clerk domain.

2. **Run the schema migrations in Supabase SQL Editor (in order):**
   - `001_initial_schema.sql` – base tables (profiles, recipes, folders, favorites, meal_dates, etc.)
   - `002_clerk_schema.sql` – adapts schema for Clerk user IDs
   - `003_add_recipe_steps.sql` – adds `steps` column to `recipes`
   - `004_drop_django_legacy_tables.sql` – drops legacy Django/api_* tables (safe if you never had them)
   - `005_enable_rls_on_app_tables.sql` – RLS policies for Clerk (`auth.jwt()->>'sub'`)
   - `006_drop_user_recipes.sql` – drops unused `user_recipes` table
   - `007_ingredients_table.sql` – ingredients table + pg_trgm for autocomplete
   - `008_recipes_search_indexes.sql` – GIN indexes for recipe search + `get_random_recipes` RPC

   Open each file under `supabase/migrations/`, copy its contents into the SQL Editor, and click **Run**. Migrations are idempotent where possible (IF EXISTS / IF NOT EXISTS).
