"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { restoreFolder } from "@/app/actions/folders";
import { restoreOwnedRecipe } from "@/app/actions/recipes";
import type { TrashedFolderRow } from "@/app/actions/folders";
import type { TrashedRecipeRow } from "@/app/actions/recipes";
import { formatTimeRemainingUntilDeletion, TRASH_RETENTION_DAYS } from "@/lib/trash-retention";

type Props = {
  initialFolders: TrashedFolderRow[];
  initialRecipes: TrashedRecipeRow[];
  listError: string | null;
};

function formatDeletedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

export function TrashRestoreSection({
  initialFolders,
  initialRecipes,
  listError,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(
    null
  );

  const clearFeedbackSoon = useCallback(() => {
    window.setTimeout(() => setFeedback(null), 4000);
  }, []);

  const onRestoreFolder = (id: string) => {
    setBusyId(id);
    setFeedback(null);
    void (async () => {
      const res = await restoreFolder(id);
      setBusyId(null);
      if (res.ok) {
        setFeedback({ kind: "success", text: "Restored." });
        clearFeedbackSoon();
        startTransition(() => router.refresh());
      } else {
        const text =
          res.reason === "not_restorable"
            ? "Could not restore (item may have been permanently removed)."
            : "Could not restore this cookbook.";
        setFeedback({ kind: "error", text });
        clearFeedbackSoon();
      }
    })();
  };

  const onRestoreRecipe = (id: string) => {
    setBusyId(id);
    setFeedback(null);
    void (async () => {
      const res = await restoreOwnedRecipe(id);
      setBusyId(null);
      if (res.ok) {
        setFeedback({ kind: "success", text: "Restored." });
        clearFeedbackSoon();
        startTransition(() => router.refresh());
      } else {
        const text =
          res.reason === "not_restorable"
            ? "Could not restore (item may have been permanently removed)."
            : "Could not restore this recipe.";
        setFeedback({ kind: "error", text });
        clearFeedbackSoon();
      }
    })();
  };

  const empty = initialFolders.length === 0 && initialRecipes.length === 0;
  const trashCount = initialFolders.length + initialRecipes.length;

  return (
    <section
      id="trash"
      className="settings-panel settings-panel--trash"
      aria-labelledby="settings-trash-heading"
    >
      <div className="settings-panel-head">
        <span className="settings-panel-icon settings-panel-icon--muted">
          <TrashIcon />
        </span>
        <div className="settings-plan-head-text">
          <div className="settings-plan-title-row">
            <h2 id="settings-trash-heading" className="dashboard-settings-h2">
              Trash
            </h2>
            {!empty ? (
              <span className="settings-trash-count" aria-label={`${trashCount} items`}>
                {trashCount}
              </span>
            ) : null}
          </div>
          <p className="settings-panel-desc">
            Cookbooks and recipes you moved to trash stay here until they are permanently deleted
            after {TRASH_RETENTION_DAYS} days.
          </p>
        </div>
      </div>

      {listError ? (
        <p className="settings-trash-feedback settings-trash-feedback--error" role="alert">
          Could not load trash: {listError}
        </p>
      ) : null}

      {feedback ? (
        <p
          className={`settings-trash-feedback settings-trash-feedback--${feedback.kind}`}
          role="status"
        >
          {feedback.text}
        </p>
      ) : null}

      {empty && !listError ? (
        <div className="settings-trash-empty-state">
          <div className="settings-trash-empty-icon" aria-hidden>
            <TrashIcon />
          </div>
          <p className="settings-trash-empty">Trash is empty</p>
          <p className="settings-trash-empty-hint">
            Deleted cookbooks and recipes will show up here for {TRASH_RETENTION_DAYS} days.
          </p>
        </div>
      ) : null}

      {!empty && initialFolders.length > 0 ? (
        <div className="settings-trash-group">
          <h3 className="settings-trash-subheading">Cookbooks</h3>
          <ul className="settings-trash-list">
            {initialFolders.map((row) => (
              <li key={row.id} className="settings-trash-row">
                <div className="settings-trash-row-body">
                  <p className="settings-trash-row-title">{row.folder_name}</p>
                  <p className="settings-trash-row-meta">
                    Deleted {formatDeletedAt(row.deleted_at)} · Permanent deletion in{" "}
                    {formatTimeRemainingUntilDeletion(row.deleted_at)}
                  </p>
                </div>
                <button
                  type="button"
                  className="settings-trash-restore"
                  disabled={isPending || busyId === row.id}
                  onClick={() => onRestoreFolder(row.id)}
                >
                  {busyId === row.id ? "Restoring…" : "Restore"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!empty && initialRecipes.length > 0 ? (
        <div className="settings-trash-group">
          <h3 className="settings-trash-subheading">Recipes</h3>
          <ul className="settings-trash-list">
            {initialRecipes.map((row) => (
              <li key={row.id} className="settings-trash-row">
                <div className="settings-trash-row-body">
                  <p className="settings-trash-row-title">{row.recipe_label}</p>
                  <p className="settings-trash-row-meta">
                    Deleted {formatDeletedAt(row.deleted_at)} · Permanent deletion in{" "}
                    {formatTimeRemainingUntilDeletion(row.deleted_at)}
                  </p>
                </div>
                <button
                  type="button"
                  className="settings-trash-restore"
                  disabled={isPending || busyId === row.id}
                  onClick={() => onRestoreRecipe(row.id)}
                >
                  {busyId === row.id ? "Restoring…" : "Restore"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
