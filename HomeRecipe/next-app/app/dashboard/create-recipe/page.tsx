"use client";

import Link from "next/link";

export default function CreateRecipePage() {
  return (
    <section className="main-panel" style={{ maxWidth: 980, margin: "0 auto" }}>
      <div
        style={{
          border: "1px solid var(--gray-300)",
          borderRadius: "var(--radius-2xl)",
          background: "var(--color-bg)",
          padding: "var(--space-6)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, color: "var(--color-fg)" }}>Create Recipe</h1>
        <p style={{ marginTop: 8, color: "var(--gray-700)", fontSize: "var(--text-sm)" }}>
          Recipe creator is ready for your custom form flow. This page can be expanded with manual
          ingredient and steps inputs next.
        </p>
        <Link
          href="/dashboard/home"
          style={{
            display: "inline-flex",
            marginTop: 16,
            minHeight: 36,
            alignItems: "center",
            justifyContent: "center",
            padding: "0 14px",
            borderRadius: "var(--radius-lg)",
            textDecoration: "none",
            background: "#33658a",
            color: "#fff",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
          }}
        >
          Back to Home
        </Link>
      </div>
    </section>
  );
}
