"use server";

import { createClient } from "@/utils/supabase/server";
import { requirePremiumPlanningAccess } from "@/lib/premium-access";

export async function getGroceryTrips() {
  const access = await requirePremiumPlanningAccess();
  if (!access.ok) return { ...access, data: [] };
  const { userId } = access;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grocery_trips")
    .select("id, planned_date, created_at")
    .eq("user_id", userId)
    .order("planned_date", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { error: null, data: data ?? [] };
}

export async function createGroceryTrip(plannedDate: string) {
  const access = await requirePremiumPlanningAccess();
  if (!access.ok) return access;
  const { userId } = access;

  const supabase = await createClient();
  const { error } = await supabase.from("grocery_trips").insert({
    user_id: userId,
    planned_date: plannedDate,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A grocery trip is already planned for this date", added: false };
    }
    return { error: error.message, added: false };
  }
  return { error: null, added: true };
}

export async function deleteGroceryTrip(id: string) {
  const access = await requirePremiumPlanningAccess();
  if (!access.ok) return access;
  const { userId } = access;

  const supabase = await createClient();
  const { error } = await supabase
    .from("grocery_trips")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  return { error: null };
}
