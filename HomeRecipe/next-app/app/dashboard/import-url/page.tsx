"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RecipeFullView } from "@/components/RecipeFullView";
import { SaveRecipeToCookbookModal } from "@/components/SaveRecipeToCookbookModal";
import {
  buildUrlImportRecipePayload,
  isUrlImportSaveable,
  urlImportToDraftRecipeRow,
} from "@/lib/processRecipeData";
import type { UrlImportedRecipe } from "@/lib/types";
import "@/app/styling/CookbookFolderPage.css";
import "@/app/styling/CookbookPageRecipeCard.css";
import "@/app/styling/VideoUpload.css";

const URL_IMPORT_STATUS_LINES = [
  "Fetching the page…",
  "Looking for recipe data…",
  "Parsing ingredients and steps…",
  "Cleaning up the result…",
] as const;

export default function ImportRecipeUrlPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UrlImportedRecipe | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [statusLineIndex, setStatusLineIndex] = useState(0);

  useEffect(() => {
    if (!loading) {
      setStatusLineIndex(0);
      return;
    }
    const t = setInterval(() => {
      setStatusLineIndex((i) => (i + 1) % URL_IMPORT_STATUS_LINES.length);
    }, 2200);
    return () => clearInterval(t);
  }, [loading]);

  const urlPayload = useMemo(
    () => (result ? buildUrlImportRecipePayload(result) : null),
    [result]
  );
  const draftRecipeRow = useMemo(
    () => (urlPayload ? urlImportToDraftRecipeRow(urlPayload) : null),
    [urlPayload]
  );
  const canSave = isUrlImportSaveable(result);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/recipes/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to import recipe URL");
      }

      setResult(data as UrlImportedRecipe);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      setError(msg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function clearResult() {
    setResult(null);
    setSaveModalOpen(false);
  }

  if (result && draftRecipeRow) {
    return (
      <>
        <div
          className="recipe-full-view-overlay"
          onClick={() => router.push("/dashboard/home")}
          onKeyDown={(e) => e.key === "Escape" && router.push("/dashboard/home")}
          role="button"
          tabIndex={0}
        >
          <div
            className="recipe-full-view-scroll-wrapper"
            onClick={(e) => e.stopPropagation()}
          >
            <RecipeFullView
              recipeData={draftRecipeRow}
              primaryActionSlot={
                <button
                  type="button"
                  className="submit-button video-recipe-save-btn"
                  style={{ margin: 0 }}
                  disabled={!canSave}
                  onClick={() => setSaveModalOpen(true)}
                >
                  Save
                </button>
              }
              onClose={() => router.push("/dashboard/home")}
            />
          </div>
        </div>
        <SaveRecipeToCookbookModal
          open={saveModalOpen}
          onClose={() => setSaveModalOpen(false)}
          payload={saveModalOpen && urlPayload ? urlPayload : null}
        />
      </>
    );
  }

  return (
    <section className="main-panel" style={{ maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: 28, color: "var(--color-fg)" }}>
        Import Recipe By URL
      </h1>
      <p style={{ marginTop: 8, marginBottom: 24, color: "var(--color-fg-muted)" }}>
        Paste a recipe link and fetch title, image, ingredients, and
        instructions. Then save to a cookbook using the same flow as video import.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          type="url"
          required
          placeholder="https://example.com/my-recipe"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{
            width: "100%",
            border: "1px solid var(--gray-300)",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 14,
            outline: "none",
            background: "var(--color-bg)",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "fit-content",
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            background: "var(--gray-950)",
            color: "var(--color-bg)",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Importing..." : "Import Recipe"}
        </button>
      </form>

      {loading ? (
        <div
          className="import-url-loading-card"
          role="status"
          aria-live="polite"
          aria-label="Import in progress"
        >
          <div className="import-url-indeterminate-track" aria-hidden>
            <div className="import-url-indeterminate-bar" />
          </div>
          <p className="import-url-rotating-line">
            {URL_IMPORT_STATUS_LINES[statusLineIndex]}
          </p>
          <p className="import-url-honest-note">
            These steps are approximate for display only—they don&apos;t reflect exact
            backend progress.
          </p>
        </div>
      ) : null}

      {error ? (
        <p style={{ color: "var(--error-fg)", marginTop: 14 }}>{error}</p>
      ) : null}
    </section>
  );
}
