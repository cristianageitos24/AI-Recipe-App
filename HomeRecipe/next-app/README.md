# HomeRecipe – Next.js App

This is the main application: Next.js (App Router + TypeScript) with Supabase (Auth + Postgres) and Open Recipes for recipe search.

## First-time clone

1. Copy env: `cp .env.local.example .env.local` and set at least **`NEXT_PUBLIC_SUPABASE_URL`**, **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`**, **`SUPABASE_SECRET_KEY`** (server/service scripts), **Clerk** keys from `.env.local.example`, and **`USDA_FDC_API_KEY`** (or **`FDC_API_KEY`**) for USDA search/detail fallback.
2. Install: `npm install`.
3. Apply **all** migrations in `supabase/migrations/` to your linked project (**`supabase db push`** or Supabase MCP **`apply_migration`** / **`list_migrations`**), not one-off Dashboard SQL for routine work.
4. Optional data: **`npm run import:fdc`** from the repo root (see root `README.md`) for the local FDC catalog.
5. Verify: **`npm run typecheck`** and **`npm run dev`**.

## Prerequisites

- **Node.js** and **npm** – to run the app and install dependencies.
- **Video Recipe Extractor (TikTok URL flow):** The video worker needs **yt-dlp** installed and on your PATH so it can download TikTok videos. Install with:
  - **pip:** `pip install yt-dlp` (ensure the Python Scripts folder is on PATH, e.g. `%APPDATA%\Python\Python*\Scripts` on Windows).
  - **Standalone:** [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases) – download the Windows executable and add it to PATH.
- **Video processing (OCR, transcription):** ffmpeg and Tesseract are required for the worker. See [VIDEO_UPLOAD_SETUP.md](VIDEO_UPLOAD_SETUP.md) for install steps.

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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (client-side) |

Optional:

- `SUPABASE_SECRET_KEY` – server/worker only; bypasses RLS for bulk import scripts and video worker
- `OPENAI_AUDIO_TRANSCRIPTION_KEY` – for video worker audio transcription (Whisper); worker-only, not exposed to browser
- `OPENAI_REASONING_API_KEY` – for video worker AI recipe extraction (GPT-4.1 nano); worker-only, not exposed to browser

## Database

Apply migrations with the **Supabase CLI** (`supabase link` and `supabase db push`) or the project **MCP `apply_migration`** hook so the linked database stays in sync with `supabase/migrations/`. Avoid pasting migration SQL in the Dashboard for routine deploys (parity and ordering are easier to verify from the repo). The table below is the **intended order** of the numbered files:

| Order | File | Purpose |
|-------|------|--------|
| 1 | `001_initial_schema.sql` | Base tables |
| 2 | `002_clerk_schema.sql` | Clerk user IDs |
| 3 | `003_add_recipe_steps.sql` | `steps` column on recipes |
| 4 | `004_drop_django_legacy_tables.sql` | Drop legacy tables |
| 5 | `005_enable_rls_on_app_tables.sql` | RLS policies for Clerk |
| 6 | `006_drop_user_recipes.sql` | Drop unused user_recipes |
| 7 | `007_ingredients_table.sql` | Legacy `ingredients` table (historical; **dropped by `030`** on linked DBs) |
| 8 | `008_recipes_search_indexes.sql` | Search indexes + recommended RPC |

See `supabase/README.md` for schema and RLS details. If you haven’t applied `008` yet, the app still works: “Recommended for you” uses a fallback query until the `get_random_recipes` RPC exists.

### Grocery (`grocery_items` / `grocery_trips`)

Migration **`027_grocery_tables.sql`** defines `grocery_items` (checklist rows) and **`grocery_trips`** (one planned trip per user per calendar date). The **Grocery** dashboard page, **Add to grocery list** on recipe detail, and **Calendar** (grocery trips as non-editable events; delete from the event popup) all use these tables via `app/actions/grocery-items.ts` and `app/actions/grocery-trips.ts`. Nothing here is a dead path.

### Legacy `public.ingredients` (removed)

Migration **`030_drop_legacy_ingredients_table.sql`** drops **`public.ingredients`**. **`007_ingredients_table.sql`** remains in the chain for fresh databases (create → later drop). Autocomplete uses **`fdc_foods`** only.

## Recipe data (Open Recipes)

To populate the app with recipes and enable search/suggestions:

1. Apply all migrations (including `007` then `030`, which removes the legacy `ingredients` table).
2. Run the import script (requires `SUPABASE_SECRET_KEY` in `.env.local`):

```bash
npm run import:recipes    # Imports recipes from Open Recipes (~230k recipes)
```

The script downloads `recipeitems-latest.json.gz` (~200MB) and imports into the `recipes` table.

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

---

## Nutrition (USDA FDC) and branded foods

- **Bulk catalog:** Foundation + SR Legacy foods are loaded from in-repo CSVs via `npm run import:fdc` (see repo root `README.md`). **Branded** packaged products are **not** fully bulk-imported.
- **Runtime:** When a line does not match the local `fdc_foods` catalog, the server calls USDA `/foods/search` and `/food/{fdcId}` with results cached in `fdc_api_cache` (see `lib/nutrition/fdc-api.ts`). Set **`USDA_FDC_API_KEY`** (or **`FDC_API_KEY`**) for API fallback; requests use retry/backoff on HTTP 429. Search uses distinct cache keys for **unfiltered** vs **`dataType=Branded`** queries (`search_v1` vs `search_branded_v1`).
- **Resolver / ranking:** Local `fdc_foods` hits and **both** general and branded API searches are **merged** and sorted by **data type** (Foundation → SR → … → Branded), then by relevance score, so branded does not win only because the general search was empty. Very strong local matches (high score) skip API calls to save quota. **Ambiguous** lines (close scores, same type tier) stay **unresolved** with stored **`fdc_candidates`**; the user can **Pick food** on the recipe detail card to set `fdc_id` and re-sync.
- **`recipes.calories` (mirror column):** **UI and `recipeRowToProcessed`** use **`recipeDisplayEnergyKcal()`** (`lib/recipe-select.ts`), which prefers **`recipe_nutrition.energy_kcal`** and falls back to **`recipes.calories`**. **Writes:** manual create / URL import / `getOrCreateRecipe` still set **`recipes.calories`** from the form or scraped data (required column + import paths); **`syncRecipeNutritionForRecipe`** upserts **`recipe_nutrition`** and **mirrors** kcal into **`recipes.calories`**. Do not read raw **`recipes.calories`** for display outside the helper.
- **Recommended next step (future migration, not done here):** When every write path that matters also persists **`recipe_nutrition`**, stop updating **`recipes.calories`** (or only backfill from `recipe_nutrition`), verify imports/CSV and older clients, then add a migration to **`DROP COLUMN recipes.calories`** after confirming zero runtime dependency on that column.
- **Autocomplete (ingredients mode):** Suggestions query **`fdc_foods.description`** on the server (service role), not the legacy `ingredients` table.
- **Selective branded bulk import:** Stub only — `npm run stub:selective-branded` (see `scripts/selective-branded-import-stub.ts`).
- **Attribution:** See **Dashboard → About** and the recipe nutrition footnote in the recipe detail view.

**Verify:** Apply migrations through **`030_drop_legacy_ingredients_table.sql`** (and **`029`** for `fdc_candidates`). Run `npm run typecheck`.

**Note:** Older migration files may still contain outdated vendor names in SQL *line* comments only; we do not rewrite applied history. Current semantics for `recipes` / `user_id` are documented in the database via `028_schema_comments_recipes_shared_catalog.sql` (`COMMENT ON`).
