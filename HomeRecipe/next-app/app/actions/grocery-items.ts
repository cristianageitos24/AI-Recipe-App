"use server";

import { createClient } from "@/utils/supabase/server";
import { requirePremiumPlanningAccess } from "@/lib/premium-access";

const GROCERY_CATEGORIES = ["produce", "dairy", "pantry", "condiments"] as const;
type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

function normalizeItemText(text: string): string {
  return text.trim().toLowerCase();
}

function normalizeCategory(category?: string | null): GroceryCategory | null {
  if (!category) return null;
  return GROCERY_CATEGORIES.includes(category as GroceryCategory)
    ? (category as GroceryCategory)
    : null;
}

function isMissingCategoryColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /category.*grocery_items|grocery_items.*category/i.test(error.message ?? "")
  );
}

export async function getGroceryItems() {
  const access = await requirePremiumPlanningAccess();
  if (!access.ok) return { ...access, data: [] };
  const { userId } = access;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grocery_items")
    .select("id, item_text, checked, created_at, category")
    .eq("user_id", userId)
    .order("checked", { ascending: true })
    .order("created_at", { ascending: true });

  if (isMissingCategoryColumnError(error)) {
    const fallback = await supabase
      .from("grocery_items")
      .select("id, item_text, checked, created_at")
      .eq("user_id", userId)
      .order("checked", { ascending: true })
      .order("created_at", { ascending: true });

    if (fallback.error) return { error: fallback.error.message, data: [] };
    return { error: null, data: fallback.data ?? [] };
  }

  if (error) return { error: error.message, data: [] };
  return { error: null, data: data ?? [] };
}

export async function addGroceryItem(itemText: string, category?: string) {
  const access = await requirePremiumPlanningAccess();
  if (!access.ok) return { ...access, added: false };
  const { userId } = access;
  const trimmed = itemText.trim();
  if (!trimmed) return { error: "Item cannot be empty", added: false };
  const normalizedCategory = normalizeCategory(category);

  const supabase = await createClient();
  const escapeIlike = trimmed.replace(/[%_\\]/g, "\\$&");
  const { data: existing } = await supabase
    .from("grocery_items")
    .select("id")
    .eq("user_id", userId)
    .ilike("item_text", escapeIlike)
    .limit(1);

  if ((existing ?? []).length > 0) {
    return { error: null, added: false, duplicate: true };
  }

  const { error } = await supabase.from("grocery_items").insert({
    user_id: userId,
    item_text: trimmed,
    checked: false,
    category: normalizedCategory,
  });

  if (isMissingCategoryColumnError(error)) {
    const fallback = await supabase.from("grocery_items").insert({
      user_id: userId,
      item_text: trimmed,
      checked: false,
    });

    if (fallback.error) return { error: fallback.error.message, added: false };
    return { error: null, added: true };
  }

  if (error) return { error: error.message, added: false };
  return { error: null, added: true };
}

export async function addGroceryItems(itemTexts: string[]) {
  const access = await requirePremiumPlanningAccess();
  if (!access.ok) {
    return { ...access, added: 0, skipped: 0, addedItems: [] as string[] };
  }
  const { userId } = access;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("grocery_items")
    .select("item_text")
    .eq("user_id", userId);

  const existingNormalized = new Set(
    (existing ?? []).map((r) => normalizeItemText((r as { item_text: string }).item_text))
  );

  const toInsert: { user_id: string; item_text: string; checked: boolean }[] = [];
  for (const text of itemTexts) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    const norm = normalizeItemText(trimmed);
    if (existingNormalized.has(norm)) continue;
    existingNormalized.add(norm);
    toInsert.push({ user_id: userId, item_text: trimmed, checked: false });
  }

  if (toInsert.length === 0) {
    return {
      error: null,
      added: 0,
      skipped: itemTexts.filter((t) => t.trim()).length,
      addedItems: [] as string[],
    };
  }

  const { error } = await supabase.from("grocery_items").insert(toInsert);
  if (error) return { error: error.message, added: 0, skipped: 0, addedItems: [] as string[] };
  return {
    error: null,
    added: toInsert.length,
    skipped: itemTexts.filter((t) => t.trim()).length - toInsert.length,
    addedItems: toInsert.map((i) => i.item_text),
  };
}

export async function removeGroceryItems(itemTexts: string[]) {
  const access = await requirePremiumPlanningAccess();
  if (!access.ok) return { ...access, removed: 0 };
  const { userId } = access;

  const normalizedToRemove = new Set(
    itemTexts.map((t) => normalizeItemText(t)).filter(Boolean)
  );
  if (normalizedToRemove.size === 0) return { error: null, removed: 0 };

  const supabase = await createClient();
  const { data, error: fetchError } = await supabase
    .from("grocery_items")
    .select("id, item_text")
    .eq("user_id", userId);

  if (fetchError) return { error: fetchError.message, removed: 0 };

  const idsToDelete = (data ?? [])
    .filter((row) =>
      normalizedToRemove.has(normalizeItemText((row as { item_text: string }).item_text ?? ""))
    )
    .map((row) => (row as { id: string }).id);

  if (idsToDelete.length === 0) return { error: null, removed: 0 };

  const { error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("user_id", userId)
    .in("id", idsToDelete);

  if (error) return { error: error.message, removed: 0 };
  return { error: null, removed: idsToDelete.length };
}

export async function toggleGroceryItemChecked(id: string) {
  const access = await requirePremiumPlanningAccess();
  if (!access.ok) return access;
  const { userId } = access;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("grocery_items")
    .select("checked")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!row) return { error: "Item not found" };

  const { error } = await supabase
    .from("grocery_items")
    .update({ checked: !(row as { checked: boolean }).checked })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function clearCheckedGroceryItems() {
  const access = await requirePremiumPlanningAccess();
  if (!access.ok) return access;
  const { userId } = access;

  const supabase = await createClient();
  const { error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("user_id", userId)
    .eq("checked", true);

  if (error) return { error: error.message };
  return { error: null };
}

export async function checkAllGroceryItems() {
  const access = await requirePremiumPlanningAccess();
  if (!access.ok) return { ...access, updated: 0 };
  const { userId } = access;

  const supabase = await createClient();
  const { data, error: fetchError } = await supabase
    .from("grocery_items")
    .select("id")
    .eq("user_id", userId)
    .eq("checked", false);

  if (fetchError) return { error: fetchError.message, updated: 0 };

  const ids = (data ?? []).map((row) => (row as { id: string }).id);
  if (ids.length === 0) return { error: null, updated: 0 };

  const { error } = await supabase
    .from("grocery_items")
    .update({ checked: true })
    .eq("user_id", userId)
    .in("id", ids);

  if (error) return { error: error.message, updated: 0 };
  return { error: null, updated: ids.length };
}

export async function uncheckAllGroceryItems() {
  const access = await requirePremiumPlanningAccess();
  if (!access.ok) return { ...access, updated: 0 };
  const { userId } = access;

  const supabase = await createClient();
  const { data, error: fetchError } = await supabase
    .from("grocery_items")
    .select("id")
    .eq("user_id", userId)
    .eq("checked", true);

  if (fetchError) return { error: fetchError.message, updated: 0 };

  const ids = (data ?? []).map((row) => (row as { id: string }).id);
  if (ids.length === 0) return { error: null, updated: 0 };

  const { error } = await supabase
    .from("grocery_items")
    .update({ checked: false })
    .eq("user_id", userId)
    .in("id", ids);

  if (error) return { error: error.message, updated: 0 };
  return { error: null, updated: ids.length };
}

export async function deleteGroceryItem(id: string) {
  const access = await requirePremiumPlanningAccess();
  if (!access.ok) return access;
  const { userId } = access;

  const supabase = await createClient();
  const { error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  return { error: null };
}
