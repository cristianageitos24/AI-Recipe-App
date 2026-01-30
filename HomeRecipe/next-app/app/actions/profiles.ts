"use server";

import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";

export async function ensureProfile() {
  const user = await currentUser();
  if (!user) return;

  const supabase = await createClient();
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const username = user.username ?? email.split("@")[0] ?? user.id;

  await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        username,
        email,
      },
      { onConflict: "id" }
    );
}
