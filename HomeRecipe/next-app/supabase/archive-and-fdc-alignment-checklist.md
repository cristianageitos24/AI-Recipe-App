# Archive + FDC alignment checklist

This file tracks the non-migration execution order and the cross-table audit backlog for the archive/wipe initiative.

## Execution order

1. Phase 0: take a Supabase backup (`pg_dump` or dashboard backup).
2. Phase 1: apply `031_legacy_recipes_archive.sql`.
3. Phase 2: apply `032_backfill_legacy_recipes_archive.sql` and verify row counts.
4. Phase 3a: apply `033_cross_table_alignment_indexes.sql`.
5. Phase 4/5: run `supabase/ops/archive_verify_and_wipe_recipes.sql` as owner/service role.
6. Smoke: create/update a user-owned recipe and confirm nutrition sync writes `recipe_ingredient_lines` and `recipe_nutrition`.

## Cross-table alignment worksheet (current state)

### Recipe graph

- `recipes`: core row; shared rows (`user_id IS NULL`) and user-owned rows both flow through app actions.
- `recipe_nutrition`: canonical totals; 1:1 with `recipes` via PK/FK.
- `recipe_ingredient_lines`: per-line provenance and unresolved state for nutrition UX.

### Non-recipe tables reviewed

- `folders`, `folder_recipes`: cascade-safe; added recipe-centric index in migration `033`.
- `favorites`: cascade-safe; added recipe-centric index in migration `033`.
- `meal_dates`, `meal_date_recipes`: cascade-safe; added recipe-centric index in migration `033`.
- `grocery_trips`, `grocery_items`: no FK to `recipes` (intentional in current model).
- `video_processing_jobs`: no FK to `recipes`; historical jobs survive recipe wipes.
- `profiles`: unrelated to recipe wipe; still source-of-truth for Clerk `sub`.
- `fdc_*` + `fdc_api_cache`: explicitly untouched by recipe archive/wipe flow.

## Prioritized backlog (P0-P2)

- P0
  - None blocking archive/wipe correctness after `031-033` and ops script run.
- P1
  - Decide whether to keep mirroring `recipes.calories` long-term or move display reads to `recipe_nutrition` only.
  - Add an explicit product rule for rendering incomplete nutrition on shared/seed recipes.
- P2
  - Optional `video_processing_jobs.saved_recipe_id` FK for traceability if product needs job-to-recipe linkage.
  - Optional storage orphan cleanup script for recipe image/video assets after destructive wipes.
  - Revisit bulk shared import + batch sync only if product revives large shared catalog strategy.
