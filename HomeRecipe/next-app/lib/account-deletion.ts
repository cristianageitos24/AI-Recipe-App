import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/utils/supabase/server";

/**
 * Permanent account data deletion (App Store Review Guideline 5.1.1(v)).
 *
 * Runs with the service-role client on purpose: `profiles` has INSERT/SELECT/
 * UPDATE policies but **no DELETE policy**, and `extraction_usage_monthly` has
 * no policies at all, so a user-scoped client cannot erase its own account.
 *
 * Order matters, and it is the inverse of what feels natural:
 * storage → recipes → usage → profile → RevenueCat, with the Clerk user
 * deleted last by the caller. Data goes first so that a failure leaves the
 * user still signed in and able to retry. Deleting the identity first would
 * strand unreachable personal data.
 *
 * Every step tolerates "already gone" so a retry after a partial failure
 * completes cleanly.
 */

/** Bucket + prefix conventions used by every upload path in the app. */
const RECIPE_COVERS_BUCKET = "recipe-covers";
const VIDEOS_BUCKET = "videos";

/** Storage removes are batched; Supabase accepts far more, but keep it modest. */
const REMOVE_CHUNK_SIZE = 100;
const LIST_PAGE_SIZE = 100;

export type AccountDeletionReport = {
  storageObjectsRemoved: number;
  recipesDeleted: number;
  /**
   * Non-fatal problems (orphaned storage objects, RevenueCat cleanup).
   * Deletion still succeeded; these are for logging and follow-up.
   */
  warnings: string[];
};

/**
 * Recursively collect every object path under `prefix`.
 * Supabase's `list` is one level deep and paginated, and folder entries come
 * back with a null `id`, which is how we tell them from files.
 */
async function listObjectPaths(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: LIST_PAGE_SIZE,
      offset,
    });

    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) return paths;

    for (const entry of data) {
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        paths.push(...(await listObjectPaths(supabase, bucket, entryPath)));
      } else {
        paths.push(entryPath);
      }
    }

    if (data.length < LIST_PAGE_SIZE) return paths;
    offset += LIST_PAGE_SIZE;
  }
}

async function removeAllUnder(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<number> {
  const paths = await listObjectPaths(supabase, bucket, prefix);
  if (paths.length === 0) return 0;

  for (let i = 0; i < paths.length; i += REMOVE_CHUNK_SIZE) {
    const chunk = paths.slice(i, i + REMOVE_CHUNK_SIZE);
    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error) throw new Error(`remove from ${bucket}: ${error.message}`);
  }

  return paths.length;
}

/**
 * Remove the RevenueCat subscriber record and the profile attributes the app
 * syncs to it (email, phone, display name, birthday).
 *
 * This does NOT cancel an active App Store subscription — only Apple can do
 * that — so callers must tell the user to cancel separately.
 */
async function deleteRevenueCatSubscriber(userId: string): Promise<void> {
  const secretKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!secretKey) {
    throw new Error("REVENUECAT_SECRET_API_KEY is not configured");
  }

  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${secretKey}` },
      cache: "no-store",
    }
  );

  // 404 means there was never a subscriber for this user — already clean.
  if (!response.ok && response.status !== 404) {
    throw new Error(`RevenueCat responded ${response.status}`);
  }
}

/**
 * Erase everything we hold for `userId` except the Clerk identity itself,
 * which the caller deletes afterwards.
 *
 * Throws if database deletion fails, so the route can return an error and
 * leave the Clerk account intact for a retry.
 */
export async function deleteAccountData(
  userId: string
): Promise<AccountDeletionReport> {
  const supabase = await createServiceRoleClient();
  const warnings: string[] = [];

  // 1. Storage first, while the rows that reference these files still exist.
  //    A failure here is recorded rather than fatal: an orphaned file is worse
  //    than nothing, but blocking deletion entirely is worse still, and the
  //    warning gives us something to reconcile.
  let storageObjectsRemoved = 0;
  try {
    storageObjectsRemoved += await removeAllUnder(
      supabase,
      RECIPE_COVERS_BUCKET,
      `users/${userId}`
    );
  } catch (error) {
    warnings.push(`recipe covers: ${errorMessage(error)}`);
  }

  try {
    storageObjectsRemoved += await removeAllUnder(
      supabase,
      VIDEOS_BUCKET,
      userId
    );
  } catch (error) {
    warnings.push(`videos: ${errorMessage(error)}`);
  }

  // 2. Recipes have no FK to profiles, so they never cascade and must go
  //    explicitly. This does cascade recipe_ingredient_lines, recipe_nutrition,
  //    favorites, folder_recipes and meal_date_recipes.
  const { data: deletedRecipes, error: recipesError } = await supabase
    .from("recipes")
    .delete()
    .eq("user_id", userId)
    .select("id");

  if (recipesError) {
    throw new Error(`Could not delete recipes: ${recipesError.message}`);
  }

  // 3. Extraction usage has neither an FK nor an RLS policy.
  const { error: usageError } = await supabase
    .from("extraction_usage_monthly")
    .delete()
    .eq("user_id", userId);

  if (usageError) {
    throw new Error(`Could not delete usage records: ${usageError.message}`);
  }

  // 4. The cascade hub: removes favorites, folders (and folder_recipes),
  //    grocery_items, grocery_trips, meal_dates (and meal_date_recipes),
  //    and video_processing_jobs.
  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (profileError) {
    throw new Error(`Could not delete profile: ${profileError.message}`);
  }

  // 5. RevenueCat holds synced profile attributes, so clear it too.
  try {
    await deleteRevenueCatSubscriber(userId);
  } catch (error) {
    warnings.push(`RevenueCat: ${errorMessage(error)}`);
  }

  return {
    storageObjectsRemoved,
    recipesDeleted: deletedRecipes?.length ?? 0,
    warnings,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
