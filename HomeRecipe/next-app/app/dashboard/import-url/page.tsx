"use client";

import { useMemo, useState } from "react";

type ImportedRecipe = {
  source_url: string;
  title: string | null;
  image: string | null;
  ingredients: string[];
  instructions: string | null;
  instructions_list: string[];
  cooktime_minutes: number | null;
  prep_time_minutes: number | null;
  total_time_minutes: number | null;
  calories: string | null;
  yields: string | null;
};

export default function ImportRecipeUrlPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportedRecipe | null>(null);

  const steps = useMemo(() => {
    if (!result) return [];
    if (result.instructions_list.length > 0) return result.instructions_list;
    if (result.instructions) {
      return result.instructions
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }
    return [];
  }, [result]);

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

      setResult(data as ImportedRecipe);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      setError(msg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="main-panel" style={{ maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Import Recipe By URL</h1>
      <p style={{ marginTop: 8, marginBottom: 24, color: "#5a5a5a" }}>
        Paste a recipe link and fetch title, image, ingredients, and
        instructions.
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
            border: "1px solid #d4d4d8",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 14,
            outline: "none",
            background: "white",
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
            background: "#111827",
            color: "#fff",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Importing..." : "Import Recipe"}
        </button>
      </form>

      {error ? (
        <p style={{ color: "var(--error-fg)", marginTop: 14 }}>{error}</p>
      ) : null}

      {result ? (
        <article
          style={{
            marginTop: 24,
            border: "1px solid #e4e4e7",
            borderRadius: 14,
            background: "#fff",
            padding: 16,
          }}
        >
          {result.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.image}
              alt={result.title || "Imported recipe image"}
              style={{
                width: "100%",
                maxHeight: 280,
                objectFit: "cover",
                borderRadius: 10,
                marginBottom: 14,
              }}
            />
          ) : null}

          <h2 style={{ marginTop: 0, marginBottom: 8 }}>
            {result.title || "Untitled Recipe"}
          </h2>
          <p style={{ marginTop: 0, color: "#52525b", fontSize: 13 }}>
            Source:{" "}
            <a href={result.source_url} target="_blank" rel="noreferrer">
              {result.source_url}
            </a>
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 10,
            }}
          >
            {result.total_time_minutes ? (
              <span style={{ fontSize: 13, color: "#3f3f46" }}>
                Total: {result.total_time_minutes} min
              </span>
            ) : null}
            {result.calories ? (
              <span style={{ fontSize: 13, color: "#3f3f46" }}>
                {result.calories}
              </span>
            ) : null}
            {result.yields ? (
              <span style={{ fontSize: 13, color: "#3f3f46" }}>
                {result.yields}
              </span>
            ) : null}
          </div>

          <h3>Ingredients</h3>
          <ul>
            {result.ingredients.map((item, index) => (
              <li key={`${index}-${item}`}>{item}</li>
            ))}
          </ul>

          <hr></hr>
          <h3>Instructions</h3>
          <ol>
            {steps.map((step, index) => (
              <li key={`${index}-${step}`}>{step}</li>
            ))}
          </ol>
        </article>
      ) : null}
    </section>
  );
}
