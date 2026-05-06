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

  return (
    <section id="trash" className="settings-trash-section" aria-labelledby="settings-trash-heading">
      <h2 id="settings-trash-heading" className="dashboard-settings-h2">
        Trash
      </h2>
      <p className="dashboard-settings-p">
        Cookbooks and recipes you moved to trash stay here until they are permanently deleted after{" "}
        {TRASH_RETENTION_DAYS} days.
      </p>

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
        <>
          <p className="settings-trash-empty">Trash is empty.</p>
          <p className="settings-trash-hint">
            If you expected items here, confirm the Clerk Supabase JWT template is configured so
            your session matches <code className="settings-trash-hint-code">user_id</code> in the
            database (see project <code className="settings-trash-hint-code">createClient</code>{" "}
            setup).
          </p>
        </>
      ) : null}

      {!empty && initialFolders.length > 0 ? (
        <>
          <h3 className="settings-trash-subheading">Cookbooks</h3>
          <ul className="settings-trash-list">
            {initialFolders.map((row) => (
              <li key={row.id} className="settings-trash-row">
                <div>
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
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {!empty && initialRecipes.length > 0 ? (
        <>
          <h3 className="settings-trash-subheading">Recipes</h3>
          <ul className="settings-trash-list">
            {initialRecipes.map((row) => (
              <li key={row.id} className="settings-trash-row">
                <div>
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
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
