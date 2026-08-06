"use client";

import { useState, useTransition } from "react";
import { saveMyProfile } from "@/app/actions/profiles";

type ProfileSectionProps = {
  email: string;
  initialDisplayName: string;
  initialPhone: string;
  initialBirthday: string;
  loadError?: string | null;
};

export function ProfileSection({
  email,
  initialDisplayName,
  initialPhone,
  initialBirthday,
  loadError = null,
}: ProfileSectionProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [phone, setPhone] = useState(initialPhone);
  const [birthday, setBirthday] = useState(initialBirthday);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(loadError ? { type: "error", message: loadError } : null);
  const [isPending, startTransition] = useTransition();

  const onSave = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await saveMyProfile({
        displayName,
        phone,
        birthday,
      });

      if (result.error || !result.data) {
        setFeedback({
          type: "error",
          message: result.error ?? "Could not save profile",
        });
        return;
      }

      setDisplayName(result.data.display_name ?? "");
      setPhone(result.data.phone_number ?? "");
      setBirthday(result.data.birthday ?? "");
      setFeedback({ type: "success", message: "Your profile was updated." });
    });
  };

  return (
    <div className="settings-profile">
      <p className="settings-panel-desc settings-profile-hint">
        Optional — saved to your HomeRecipe profile and shared with the mobile
        app.
      </p>

      <div className="settings-profile-fields">
        <label className="settings-field">
          <span className="settings-field-label">Email</span>
          <input
            type="email"
            className="settings-field-input settings-field-input--readonly"
            value={email || "No email"}
            readOnly
            disabled
            aria-readonly="true"
          />
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Display name</span>
          <input
            type="text"
            className="settings-field-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How should we greet you?"
            autoComplete="name"
            maxLength={120}
            disabled={isPending}
          />
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Phone</span>
          <input
            type="tel"
            className="settings-field-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 555 5555"
            autoComplete="tel"
            disabled={isPending}
          />
        </label>

        <label className="settings-field">
          <span className="settings-field-label">Birthday</span>
          <input
            type="text"
            className="settings-field-input"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            placeholder="YYYY-MM-DD"
            inputMode="numeric"
            autoComplete="bday"
            disabled={isPending}
          />
        </label>
      </div>

      {feedback ? (
        <p
          className={
            feedback.type === "success"
              ? "settings-trash-feedback settings-trash-feedback--success"
              : "settings-trash-feedback settings-trash-feedback--error"
          }
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="settings-panel-actions">
        <button
          type="button"
          className="settings-btn settings-btn--primary"
          onClick={onSave}
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}
