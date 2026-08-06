# HomeRecipe – Next.js App

This is the main application: Next.js (App Router + TypeScript) with Supabase (Auth + Postgres) and Open Recipes for recipe search.

## First-time clone

1. Copy env: `cp .env.local.example .env.local` and set at least **`NEXT_PUBLIC_SUPABASE_URL`**, **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`**, **`SUPABASE_SECRET_KEY`** (server/service scripts), **Clerk** keys from `.env.local.example`, **`USDA_FDC_API_KEY`** (or **`FDC_API_KEY`**) for USDA search/detail, and optionally **`FDC_HOURLY_SOFT_CAP`** (default **900** outbound USDA calls per UTC hour).
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

- `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_KEY`) – server/worker only; bypasses RLS for bulk import scripts, FDC resolver, and video worker
- `USDA_FDC_API_KEY` or `FDC_API_KEY` – USDA `/foods/search` and `/food/{id}` (server-only)
- `FDC_HOURLY_SOFT_CAP` – max outbound USDA HTTP calls per **UTC hour** (default **900**); enforced via `fdc_api_hourly_usage` + `fdc_reserve_outbound_slot` (server-only)
- `NUTRITION_ESTIMATE_OPENAI_API_KEY` – nutrition AI fallback; if unset, `OPENAI_REASONING_API_KEY` is used when present
- `OPENAI_AUDIO_TRANSCRIPTION_KEY` – video worker audio transcription (Whisper); worker-only
- `OPENAI_REASONING_API_KEY` – video worker AI recipe extraction; also fallback for nutrition estimate when `NUTRITION_ESTIMATE_OPENAI_API_KEY` is unset
- `SUPABASE_DB_PASSWORD` – optional; for Supabase CLI database connection (`supabase link` / `db push`), not read by the app at runtime
- `REVENUECAT_WEBHOOK_SECRET` – Authorization header value for `POST /api/webhooks/revenuecat` (Apple IAP → `profiles.plan_tier` sync). Configure the same value in RevenueCat Dashboard → Integrations → Webhooks pointing at `https://<production-host>/api/webhooks/revenuecat`. Sandbox and production events are both fine.

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
| 9 | `009_ensure_search_indexes.sql` | Idempotent search index safety |
| 10-30 | `010` through `030` | Video jobs, storage, user scoping, grocery, FDC nutrition, and cleanup migrations |
| 31 | `031_legacy_recipes_archive.sql` | Archive table + RLS hardening (`legacy_recipes_archive`) |
| 32 | `032_backfill_legacy_recipes_archive.sql` | Snapshot backfill + strict pre-wipe verification gate |
| 33 | `033_cross_table_alignment_indexes.sql` | Additive cross-table recipe-centric indexes |
| 34 | `034_fdc_api_hourly_usage.sql` | Shared hourly USDA outbound quota (`fdc_api_hourly_usage` + RPC) |
| 35 | `035_fdc_api_hourly_usage_utc_trunc_fix.sql` | UTC `date_trunc` for quota buckets |

See `supabase/README.md` for schema and RLS details. If you haven’t applied `008` yet, the app still works: “Recommended for you” uses a fallback query until the `get_random_recipes` RPC exists.

### Grocery (`grocery_items` / `grocery_trips`)

Migration **`027_grocery_tables.sql`** defines `grocery_items` (checklist rows) and **`grocery_trips`** (one planned trip per user per calendar date). The **Grocery** dashboard page, **Add to grocery list** on recipe detail, and **Calendar** (grocery trips as non-editable events; delete from the event popup) all use these tables via `app/actions/grocery-items.ts` and `app/actions/grocery-trips.ts`. Nothing here is a dead path.

### Legacy `public.ingredients` (removed)

Migration **`030_drop_legacy_ingredients_table.sql`** drops **`public.ingredients`**. **`007_ingredients_table.sql`** remains in the chain for fresh databases (create → later drop). Autocomplete uses **`fdc_foods`** only.

## Recipe data strategy (MVP)

The default launch model is **user-generated growth** (manual, URL import, video extraction) with optional small curated seeds.

- Bulk shared-catalog import is **not required** for day-one correctness.
- Shared/seed recipes without nutrition sync should be shown as incomplete/not-computed in product UX.

### Optional bulk Open Recipes import (deferred by default)

If you explicitly want a large shared catalog for testing or a later product phase:

1. Apply all migrations (including `007` then `030`, which removes the legacy `ingredients` table).
2. Run the import script (requires `SUPABASE_SECRET_KEY` in `.env.local`):

```bash
npm run import:recipes    # Imports recipes from Open Recipes (~230k recipes)
```

The script downloads `recipeitems-latest.json.gz` (~200MB) and imports into the `recipes` table.

### Archive + wipe operational flow

- Apply migrations through `035`.
- Run `supabase/ops/archive_verify_and_wipe_recipes.sql` as database owner or service role when you are ready for a full reset.
- Follow `supabase/archive-and-fdc-alignment-checklist.md` for phased execution and smoke checks.

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
- **API-first resolution:** When **`USDA_FDC_API_KEY`** / **`FDC_API_KEY`** is set and the hourly quota allows, each ingredient line runs USDA **`/foods/search`** (general + **`dataType=Branded`**) **before** local `fdc_foods` matching. If the API returns hits, only **API-derived** candidates are ranked (no local rows mixed into that list). If the API returns nothing useful, or non-429 search errors occur, the resolver falls back to the **local** catalog path (merge local only). **`fdc_api_cache`** still avoids repeat HTTP for identical search/detail keys (`search_v1` vs `search_branded_v1`, `detail_v1`).
- **Hourly quota (app-wide):** Outbound USDA **`fetch`** calls (after cache miss) increment **`fdc_api_hourly_usage`** via RPC **`fdc_reserve_outbound_slot`**, capped by **`FDC_HOURLY_SOFT_CAP`** (default **900** per **UTC hour**). Each attempt including **429 retries** reserves one slot before **`fetch`**. Rows older than **90 days** UTC are deleted at the start of that RPC. If the cap is hit (**`quota_exhausted`**) or search returns **429** after retries (**`rate_limited`**), that line uses local matching and **`syncRecipeNutritionForRecipe`** sets a batch flag so **remaining lines in the same sync** skip USDA **search** and live **`/food/{id}`** detail (DB + cache reads only for nutrients).
- **429 / errors:** Search **429** or quota exhaustion sets the batch guard for the rest of the sync; other search failures fall back **for that line only** without enabling the batch guard. Detail failures never throw to the sync and do not alone enable the batch guard.
- **URL import:** USDA is **not** called during the Python scrape; nutrition sync runs when the recipe is **saved** (server actions).
- **Docker:** `recipe-url-import` and `video-worker` images do **not** need a rebuild for FDC changes; redeploy the **Next.js** app that runs server actions.
- **Ambiguous** lines (close scores, same type tier) stay **unresolved** with stored **`fdc_candidates`**; the user can **Pick food** on the recipe detail card to set `fdc_id` and re-sync. Each new sync starts with the batch guard **off** (including after **Pick food**).
- **`recipes.calories` (mirror column):** **UI and `recipeRowToProcessed`** use **`recipeDisplayEnergyKcal()`** (`lib/recipe-select.ts`), which prefers **`recipe_nutrition.energy_kcal`** and falls back to **`recipes.calories`**. **Writes:** manual create / URL import / `getOrCreateRecipe` still set **`recipes.calories`** from the form or scraped data (required column + import paths); **`syncRecipeNutritionForRecipe`** upserts **`recipe_nutrition`** and **mirrors** kcal into **`recipes.calories`**. Do not read raw **`recipes.calories`** for display outside the helper.
- **Recommended next step (future migration, not done here):** When every write path that matters also persists **`recipe_nutrition`**, stop updating **`recipes.calories`** (or only backfill from `recipe_nutrition`), verify imports/CSV and older clients, then add a migration to **`DROP COLUMN recipes.calories`** after confirming zero runtime dependency on that column.
- **Autocomplete (ingredients mode):** Suggestions query **`fdc_foods.description`** on the server (service role), not the legacy `ingredients` table.
- **Selective branded bulk import:** Stub only — `npm run stub:selective-branded` (see `scripts/selective-branded-import-stub.ts`).
- **Attribution:** See **Dashboard → About** and the recipe nutrition footnote in the recipe detail view.

**Verify:** Apply migrations through **`035`** (FDC quota). Run `npm run typecheck`.

**Note:** Older migration files may still contain outdated vendor names in SQL *line* comments only; we do not rewrite applied history. Current semantics for `recipes` / `user_id` are documented in the database via `028_schema_comments_recipes_shared_catalog.sql` (`COMMENT ON`).
