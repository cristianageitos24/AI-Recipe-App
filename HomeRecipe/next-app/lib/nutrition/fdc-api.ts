import type { SupabaseClient } from "@supabase/supabase-js";

import { FDC_NUTRIENT } from "@/lib/nutrition/constants";

const FDC_BASE = "https://api.nal.usda.gov/fdc/v1";
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_429_ATTEMPTS = 5;

export function getFdcApiKey(): string | null {
  const k = process.env.USDA_FDC_API_KEY || process.env.FDC_API_KEY;
  return k?.trim() || null;
}

export function getFdcHourlySoftCap(): number {
  const raw = process.env.FDC_HOURLY_SOFT_CAP?.trim();
  if (!raw) return 900;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 900;
}

function normalizeSearchQuery(q: string): string {
  return q
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 200);
}

function isCacheFresh(fetchedAt: string | null): boolean {
  if (!fetchedAt) return false;
  const t = new Date(fetchedAt).getTime();
  return Date.now() - t < CACHE_TTL_MS;
}

export type FdcSearchOptions = {
  /** USDA `dataType` filter (e.g. `Branded`); uses a separate `fdc_api_cache` row from unfiltered search. */
  dataType?: string;
};

export type FdcSearchFood = {
  fdcId: number;
  description: string;
  dataType?: string;
  score?: number;
};

export type FdcSearchResponse = {
  foods?: Array<{
    fdcId?: number;
    description?: string;
    dataType?: string;
    score?: number;
  }>;
};

export type FdcSearchOutcome =
  | { kind: "ok"; foods: FdcSearchFood[] }
  | { kind: "rate_limited" }
  | { kind: "quota_exhausted" }
  | { kind: "error" };

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

type ReserveJson = { allowed?: boolean; outbound_calls_after?: number };

async function reserveOutboundSlot(svc: SupabaseClient): Promise<ReserveJson> {
  const cap = getFdcHourlySoftCap();
  const { data, error } = await svc.rpc("fdc_reserve_outbound_slot", { p_cap: cap });
  if (error) {
    console.warn("fdc_reserve_outbound_slot", error.message);
    return { allowed: false, outbound_calls_after: 0 };
  }
  return (data ?? {}) as ReserveJson;
}

/**
 * Reserve quota then fetch USDA; each 429 retry reserves again and issues another fetch (per spec).
 */
async function fetchUsdaWithQuota(
  svc: SupabaseClient,
  url: string,
  init: RequestInit
): Promise<
  | { kind: "response"; res: Response }
  | { kind: "quota_exhausted" }
  | { kind: "rate_limited" }
  | { kind: "fetch_error"; err: unknown }
> {
  let delay = 800;
  for (let attempt = 0; attempt < MAX_429_ATTEMPTS; attempt++) {
    const slot = await reserveOutboundSlot(svc);
    if (!slot.allowed) {
      return { kind: "quota_exhausted" };
    }
    try {
      const res = await fetch(url, { ...init, cache: "no-store" });
      if (res.status !== 429) {
        return { kind: "response", res };
      }
      if (attempt === MAX_429_ATTEMPTS - 1) {
        return { kind: "rate_limited" };
      }
      const retryAfter = res.headers.get("retry-after");
      const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;
      await sleep(Number.isFinite(wait) && wait > 0 ? wait : delay);
      delay = Math.min(delay * 2, 30_000);
    } catch (err) {
      return { kind: "fetch_error", err };
    }
  }
  return { kind: "rate_limited" };
}

function searchCacheDataTypeKey(options?: FdcSearchOptions): string {
  const dt = options?.dataType?.trim();
  if (!dt) return "search_v1";
  const slug = dt.toLowerCase().replace(/\s+/g, "_");
  return `search_${slug}_v1`;
}

export async function fdcSearchFoodsWithOutcome(
  svc: SupabaseClient,
  query: string,
  options?: FdcSearchOptions
): Promise<FdcSearchOutcome> {
  const apiKey = getFdcApiKey();
  const qn = normalizeSearchQuery(query);
  if (!qn) {
    return { kind: "ok", foods: [] };
  }

  const cacheFilter = searchCacheDataTypeKey(options);

  const { data: cached } = await svc
    .from("fdc_api_cache")
    .select("payload, fetched_at")
    .eq("query_normalized", `search:${qn}`)
    .eq("data_type_filter", cacheFilter)
    .maybeSingle();

  if (cached?.payload && isCacheFresh(cached.fetched_at as string)) {
    const parsed = cached.payload as FdcSearchResponse;
    return { kind: "ok", foods: mapSearchFoods(parsed) };
  }

  if (!apiKey) {
    return { kind: "ok", foods: [] };
  }

  const params = new URLSearchParams({
    query: qn,
    pageSize: "15",
    api_key: apiKey,
  });
  const dt = options?.dataType?.trim();
  if (dt) {
    params.set("dataType", dt);
  }

  const url = `${FDC_BASE}/foods/search?${params.toString()}`;

  const fetched = await fetchUsdaWithQuota(svc, url, { method: "GET" });
  if (fetched.kind === "quota_exhausted") {
    return { kind: "quota_exhausted" };
  }
  if (fetched.kind === "rate_limited") {
    return { kind: "rate_limited" };
  }
  if (fetched.kind === "fetch_error") {
    return { kind: "error" };
  }

  const res = fetched.res;
  if (!res.ok) {
    console.warn("fdcSearchFoodsWithOutcome HTTP", res.status);
    return { kind: "error" };
  }

  let json: FdcSearchResponse;
  try {
    json = (await res.json()) as FdcSearchResponse;
  } catch {
    return { kind: "error" };
  }

  const { error: upsertErr } = await svc.from("fdc_api_cache").upsert(
    {
      query_normalized: `search:${qn}`,
      data_type_filter: cacheFilter,
      payload: json as unknown as Record<string, unknown>,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "query_normalized,data_type_filter" }
  );
  if (upsertErr) {
    console.warn("fdc_api_cache search upsert", upsertErr.message);
  }

  return { kind: "ok", foods: mapSearchFoods(json) };
}

/** Legacy helper: maps non-quota outcomes to an empty list. Prefer `fdcSearchFoodsWithOutcome`. */
export async function fdcSearchFoodsCached(
  svc: SupabaseClient,
  query: string,
  options?: FdcSearchOptions
): Promise<FdcSearchFood[]> {
  const o = await fdcSearchFoodsWithOutcome(svc, query, options);
  if (o.kind === "ok") return o.foods;
  return [];
}

function mapSearchFoods(json: FdcSearchResponse): FdcSearchFood[] {
  const foods = json.foods ?? [];
  const out: FdcSearchFood[] = [];
  for (const f of foods) {
    const id = f.fdcId;
    if (typeof id !== "number" || !f.description) continue;
    out.push({
      fdcId: id,
      description: f.description,
      dataType: f.dataType,
      score: typeof f.score === "number" ? f.score : undefined,
    });
  }
  return out;
}

export type NutrientsPer100g = {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
};

function nutrientsFromFoodNutrients(
  rows: Array<{ nutrientId?: number; nutrient?: { id?: number }; amount?: number }>
): NutrientsPer100g | null {
  let kcal = 0;
  let p = 0;
  let f = 0;
  let c = 0;
  let any = false;

  for (const row of rows) {
    const nid = row.nutrient?.id ?? row.nutrientId;
    const amt = row.amount;
    if (typeof nid !== "number" || typeof amt !== "number" || !Number.isFinite(amt)) {
      continue;
    }
    any = true;
    if (nid === FDC_NUTRIENT.ENERGY_KCAL) kcal += amt;
    else if (nid === FDC_NUTRIENT.PROTEIN) p += amt;
    else if (nid === FDC_NUTRIENT.FAT) f += amt;
    else if (nid === FDC_NUTRIENT.CARB) c += amt;
  }

  if (!any) return null;
  return { kcal, protein_g: p, fat_g: f, carb_g: c };
}

export type FdcFoodDetailOptions = {
  /** When true, do not call USDA (cache read only after DB miss at caller). */
  skipLiveUsdaDetail?: boolean;
};

export async function fdcFoodDetailCached(
  svc: SupabaseClient,
  fdcId: number,
  opts?: FdcFoodDetailOptions
): Promise<NutrientsPer100g | null> {
  const apiKey = getFdcApiKey();
  const key = `food:${fdcId}`;

  const { data: cached } = await svc
    .from("fdc_api_cache")
    .select("payload, fetched_at")
    .eq("query_normalized", key)
    .eq("data_type_filter", "detail_v1")
    .maybeSingle();

  if (cached?.payload && isCacheFresh(cached.fetched_at as string)) {
    const payload = cached.payload as { foodNutrients?: typeof cached.payload };
    const n = nutrientsFromFoodNutrients(
      (payload as { foodNutrients?: unknown[] }).foodNutrients as Parameters<
        typeof nutrientsFromFoodNutrients
      >[0]
    );
    if (n) return n;
  }

  if (opts?.skipLiveUsdaDetail || !apiKey) {
    return null;
  }

  const url = `${FDC_BASE}/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`;
  const fetched = await fetchUsdaWithQuota(svc, url, { method: "GET" });
  if (fetched.kind === "quota_exhausted" || fetched.kind === "rate_limited") {
    return null;
  }
  if (fetched.kind === "fetch_error") {
    return null;
  }

  const res = fetched.res;
  if (!res.ok) {
    console.warn("fdcFoodDetailCached HTTP", res.status);
    return null;
  }

  let json: { foodNutrients?: Parameters<typeof nutrientsFromFoodNutrients>[0] };
  try {
    json = (await res.json()) as { foodNutrients?: Parameters<typeof nutrientsFromFoodNutrients>[0] };
  } catch {
    return null;
  }

  const { error: upsertErr } = await svc.from("fdc_api_cache").upsert(
    {
      query_normalized: key,
      data_type_filter: "detail_v1",
      payload: json as unknown as Record<string, unknown>,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "query_normalized,data_type_filter" }
  );
  if (upsertErr) {
    console.warn("fdc_api_cache detail upsert", upsertErr.message);
  }

  return nutrientsFromFoodNutrients(json.foodNutrients ?? []);
}
