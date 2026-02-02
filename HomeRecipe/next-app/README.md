# HomeRecipe – Next.js App

This is the main application: Next.js (App Router + TypeScript) with Supabase (Auth + Postgres) and Open Recipes for recipe search.

## Development

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local with Supabase keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create `.env.local` from `.env.local.example` and set:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

Optional (for import scripts and admin operations):

- `SUPABASE_SERVICE_ROLE_KEY` – bypasses RLS for bulk import scripts

## Database

Run the SQL migrations in **order** in the Supabase SQL Editor (Dashboard → SQL Editor → New query). Copy each file from `supabase/migrations/` and run it:

| Order | File | Purpose |
|-------|------|--------|
| 1 | `001_initial_schema.sql` | Base tables |
| 2 | `002_clerk_schema.sql` | Clerk user IDs |
| 3 | `003_add_recipe_steps.sql` | `steps` column on recipes |
| 4 | `004_drop_django_legacy_tables.sql` | Drop legacy tables |
| 5 | `005_enable_rls_on_app_tables.sql` | RLS policies for Clerk |
| 6 | `006_drop_user_recipes.sql` | Drop unused user_recipes |
| 7 | `007_ingredients_table.sql` | Ingredients + autocomplete |
| 8 | `008_recipes_search_indexes.sql` | Search indexes + recommended RPC |

See `supabase/README.md` for schema and RLS details. If you haven’t run 008 yet, the app still works: “Recommended for you” uses a fallback query until the `get_random_recipes` RPC exists.

## Recipe data (Open Recipes)

To populate the app with recipes and enable search/suggestions:

1. Apply all migrations (including `007_ingredients_table.sql`).
2. Run the import scripts (requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`):

```bash
npm run import:recipes    # Imports recipes from Open Recipes (~230k recipes)
npm run import:ingredients # Extracts ingredients for autocomplete
```

The first script downloads `recipeitems-latest.json.gz` (~200MB) and imports into the `recipes` table. The second reads from `recipes` and populates the `ingredients` table.

## Build

```bash
npm run build
npm start
```

## Deploy on Vercel

1. Set the project **Root Directory** to this folder (`next-app`) in Vercel.
2. Add the environment variables above in Vercel.
3. Deploy.

See [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for more options.
