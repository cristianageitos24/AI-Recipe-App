"use client";

import { useClerk } from "@clerk/nextjs";

export function OpenAccountButton() {
  const { openUserProfile } = useClerk();

  return (
    <button
      type="button"
      className="settings-btn settings-btn--secondary"
      onClick={() => openUserProfile()}
    >
      Manage account
    </button>
  );
}
