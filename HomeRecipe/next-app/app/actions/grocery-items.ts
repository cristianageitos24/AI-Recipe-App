"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";

function normalizeItemText(text: string): string {
  return text.trim().toLowerCase();
}

export async function getGroceryItems() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", data: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grocery_items")
    .select("id, item_text, checked, created_at")
    .eq("user_id", userId)
    .order("checked", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { error: null, data: data ?? [] };
}

export async function addGroceryItem(itemText: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", added: false };
  const trimmed = itemText.trim();
  if (!trimmed) return { error: "Item cannot be empty", added: false };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("grocery_items")
    .select("item_text")
    .eq("user_id", userId);

  const normalized = normalizeItemText(trimmed);
  const isDuplicate = (existing ?? []).some(
    (row) => normalizeItemText((row as { item_text: string }).item_text ?? "") === normalized
  );
  if (isDuplicate) return { error: null, added: false, duplicate: true };

  const { error } = await supabase.from("grocery_items").insert({
    user_id: userId,
    item_text: trimmed,
    checked: false,
  });

  if (error) return { error: error.message, added: false };
  return { error: null, added: true };
}

export async function addGroceryItems(itemTexts: string[]) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", added: 0, skipped: 0 };

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
    return { error: null, added: 0, skipped: itemTexts.filter((t) => t.trim()).length };
  }

  const { error } = await supabase.from("grocery_items").insert(toInsert);
  if (error) return { error: error.message, added: 0, skipped: 0 };
  return { error: null, added: toInsert.length, skipped: itemTexts.filter((t) => t.trim()).length - toInsert.length };
}

export async function toggleGroceryItemChecked(id: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

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
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("user_id", userId)
    .eq("checked", true);

  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteGroceryItem(id: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  return { error: null };
}
