"use server";

import { clerkClient, currentUser } from "@clerk/nextjs/server";
import {
  birthdayFromDb,
  lightPhoneLooksOk,
  normalizeBirthdayInput,
  normalizeDisplayNameInput,
  normalizePhoneInput,
} from "@/lib/profile";
import { createClient } from "@/utils/supabase/server";

export type ProfileDetails = {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  phone_number: string | null;
  birthday: string | null;
};

export async function ensureProfile() {
  const user = await currentUser();
  if (!user) return;

  const supabase = await createClient();
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const username = user.username ?? email.split("@")[0] ?? user.id;

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      username,
      email,
    },
    { onConflict: "id" }
  );
}

/**
 * Load editable profile fields for the signed-in user.
 * Calls ensureProfile first so a row exists.
 */
export async function getMyProfile(): Promise<{
  error: string | null;
  data: ProfileDetails | null;
  clerkEmail: string;
  clerkDisplayNameFallback: string;
}> {
  const user = await currentUser();
  if (!user) {
    return {
      error: "Unauthorized",
      data: null,
      clerkEmail: "",
      clerkDisplayNameFallback: "",
    };
  }

  const clerkEmail = user.primaryEmailAddress?.emailAddress ?? "";
  const clerkDisplayNameFallback =
    user.fullName?.trim() || user.firstName?.trim() || "";

  await ensureProfile();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, username, display_name, phone_number, birthday")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return {
      error: error.message,
      data: null,
      clerkEmail,
      clerkDisplayNameFallback,
    };
  }

  if (!data) {
    return {
      error: null,
      data: null,
      clerkEmail,
      clerkDisplayNameFallback,
    };
  }

  return {
    error: null,
    data: {
      id: data.id as string,
      email: (data.email as string) ?? clerkEmail,
      username: data.username as string,
      display_name: (data.display_name as string | null) ?? null,
      phone_number: (data.phone_number as string | null) ?? null,
      birthday: birthdayFromDb(data.birthday),
    },
    clerkEmail,
    clerkDisplayNameFallback,
  };
}

/**
 * Save optional profile fields to Supabase. Best-effort Clerk name sync
 * does not fail the save if Clerk update fails.
 * Web does not sync RevenueCat — mobile picks that up on next sign-in/save.
 */
export async function saveMyProfile(input: {
  displayName: string;
  phone: string;
  birthday: string;
}): Promise<{
  error: string | null;
  data: ProfileDetails | null;
}> {
  const user = await currentUser();
  if (!user) {
    return { error: "Unauthorized", data: null };
  }

  const email = user.primaryEmailAddress?.emailAddress ?? "";
  if (!email) {
    return {
      error: "You need an email on your account to save your profile.",
      data: null,
    };
  }

  const username = user.username ?? email.split("@")[0] ?? user.id;

  const nextDisplayName = normalizeDisplayNameInput(input.displayName);
  const nextPhone = normalizePhoneInput(input.phone);
  const birthdayResult = normalizeBirthdayInput(input.birthday);

  if (birthdayResult.error) {
    return { error: birthdayResult.error, data: null };
  }
  if (!lightPhoneLooksOk(nextPhone)) {
    return {
      error: "Enter a valid phone number, or leave it blank.",
      data: null,
    };
  }

  await ensureProfile();

  const supabase = await createClient();
  const patch = {
    id: user.id,
    email,
    username,
    display_name: nextDisplayName,
    phone_number: nextPhone,
    birthday: birthdayResult.value,
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(patch, { onConflict: "id" })
    .select("id, email, username, display_name, phone_number, birthday")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not save profile", data: null };
  }

  // Best-effort Clerk name update — do not fail the whole save.
  if (nextDisplayName) {
    try {
      const parts = nextDisplayName.split(/\s+/);
      const firstName = parts[0] || nextDisplayName;
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
      const client = await clerkClient();
      await client.users.updateUser(user.id, { firstName, lastName });
    } catch (err) {
      console.warn("[profiles] Clerk name update failed:", err);
    }
  }

  return {
    error: null,
    data: {
      id: data.id as string,
      email: data.email as string,
      username: data.username as string,
      display_name: (data.display_name as string | null) ?? null,
      phone_number: (data.phone_number as string | null) ?? null,
      birthday: birthdayFromDb(data.birthday),
    },
  };
}
