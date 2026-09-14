"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";

/**
 * Permanent account deletion (App Store Review Guideline 5.1.1(v) parity with
 * the iOS app — one account system, so the web needs the same control).
 *
 * Two steps on purpose: opening the panel is not enough, the user also has to
 * type the confirmation word. Deletion cannot be undone, so a single
 * misplaced click should not be able to trigger it.
 */

const CONFIRMATION_PHRASE = "DELETE";

type DeleteAccountSectionProps = {
  /** Shows the Apple billing warning when Pro came from an App Store purchase. */
  hasAppleSubscription: boolean;
};

export function DeleteAccountSection({
  hasAppleSubscription,
}: DeleteAccountSectionProps) {
  const { signOut } = useClerk();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmation.trim().toUpperCase() === CONFIRMATION_PHRASE;

  const onCancel = () => {
    setIsOpen(false);
    setConfirmation("");
    setError(null);
  };

  const onDelete = async () => {
    if (!canDelete || isDeleting) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: CONFIRMATION_PHRASE }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(
          payload?.error ??
            "We could not delete your account. Please try again."
        );
        setIsDeleting(false);
        return;
      }

      // The Clerk user is gone; clear the local session and leave the dashboard.
      await signOut({ redirectUrl: "/" });
    } catch {
      setError(
        "We could not reach the server. Check your connection and try again."
      );
      setIsDeleting(false);
    }
  };

  return (
    <div className="settings-danger">
      {!isOpen ? (
        <div className="settings-panel-actions">
          <button
            type="button"
            className="settings-btn settings-btn--danger"
            onClick={() => setIsOpen(true)}
          >
            Delete account
          </button>
        </div>
      ) : (
        <div className="settings-danger-confirm">
          <p className="settings-danger-lede">
            This permanently deletes your profile, the recipes you created,
            cookbooks, favorites, meal calendar entries, grocery lists, and
            uploaded images and videos. It cannot be undone.
          </p>

          {hasAppleSubscription ? (
            <p className="settings-danger-warning">
              Your Pro subscription was purchased through the App Store.
              Deleting your account does not cancel it — cancel it in{" "}
              <a
                href="https://apps.apple.com/account/subscriptions"
                target="_blank"
                rel="noreferrer"
              >
                your Apple subscription settings
              </a>{" "}
              or Apple will keep billing you.
            </p>
          ) : null}

          <label className="settings-field">
            <span className="settings-field-label">
              Type {CONFIRMATION_PHRASE} to confirm
            </span>
            <input
              type="text"
              className="settings-field-input"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={CONFIRMATION_PHRASE}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={isDeleting}
            />
          </label>

          {error ? (
            <p className="settings-trash-feedback settings-trash-feedback--error">
              {error}
            </p>
          ) : null}

          <div className="settings-panel-actions">
            <button
              type="button"
              className="settings-btn settings-btn--danger"
              onClick={onDelete}
              disabled={!canDelete || isDeleting}
            >
              {isDeleting ? "Deleting…" : "Permanently delete my account"}
            </button>
            <button
              type="button"
              className="settings-btn settings-btn--secondary"
              onClick={onCancel}
              disabled={isDeleting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
