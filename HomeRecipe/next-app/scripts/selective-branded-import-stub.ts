/**
 * Selective branded FDC import (stub — Phase E optional).
 *
 * Full USDA Branded CSVs are multi‑GB; a future implementation could:
 * - Rank candidate `fdc_id`s from `recipe_ingredient_lines` / resolver logs
 * - Import top‑N by frequency via batched upserts into `fdc_foods` / child tables
 * - Or call `/food/{fdcId}` for each and persist nutrients (API + `fdc_api_cache`)
 *
 * Prerequisites: `DATABASE_URL` or Supabase service role + `npm run import:fdc` patterns.
 * Do not run a full branded CSV load without explicit disk/budget approval (see project plan §8).
 *
 * Usage (when implemented): `npx tsx scripts/selective-branded-import-stub.ts`
 */
console.log(
  "selective-branded-import: stub only — see comments in scripts/selective-branded-import-stub.ts"
);
process.exit(0);
