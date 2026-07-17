import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTrashedFolders } from "@/app/actions/folders";
import { getTrashedRecipes } from "@/app/actions/recipes";
import { getMyEntitlements } from "@/app/actions/entitlements";
import { FREE_RECIPE_TTL_DAYS } from "@/lib/entitlements";
import { TRASH_RETENTION_DAYS } from "@/lib/trash-retention";
import { TrashRestoreSection } from "./TrashRestoreSection";
import "@/app/styling/SettingsPage.css";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  const [foldersRes, recipesRes, entitlementsRes] = await Promise.all([
    getTrashedFolders(),
    getTrashedRecipes(),
    getMyEntitlements(),
  ]);

  const listError =
    [foldersRes.error, recipesRes.error].filter(Boolean).join(" · ") || null;
  const entitlements = entitlementsRes.data;

  return (
    <div className="dashboard-settings">
      <h1 className="dashboard-settings-title">Settings</h1>

      <section aria-labelledby="settings-account-heading">
        <h2 id="settings-account-heading" className="dashboard-settings-h2">
          Account
        </h2>
        <p className="dashboard-settings-p">
          Profile and security are managed in the header: open <strong>Account</strong>, then{" "}
          <strong>Manage account</strong>.
        </p>
      </section>

      <section aria-labelledby="settings-plan-heading">
        <h2 id="settings-plan-heading" className="dashboard-settings-h2">
          Your plan
        </h2>
        <p className="dashboard-settings-p">
          Current plan:{" "}
          <strong>{entitlements?.isPro ? "Pro" : "Free"}</strong>
          {!entitlements?.isPro ? (
            <>
              {" "}
              · Extractions this month: {entitlements?.extractionsUsed ?? 0} /{" "}
              {entitlements?.extractionsLimit ?? 3}. Free recipes expire after{" "}
              {FREE_RECIPE_TTL_DAYS} days.
            </>
          ) : (
            <> · Unlimited extractions and permanent recipes.</>
          )}
        </p>
        <p className="dashboard-settings-p">
          <Link href="/dashboard/billing" className="dashboard-settings-link">
            Manage Free vs Pro
          </Link>{" "}
          — upgrade, invoices, and payment methods (Stripe Checkout + Customer Portal).
        </p>
      </section>

      <section aria-labelledby="settings-about-heading">
        <h2 id="settings-about-heading" className="dashboard-settings-h2">
          About / help
        </h2>
        <p className="dashboard-settings-p">
          <Link href="/dashboard/about" className="dashboard-settings-link">
            Open the About page
          </Link>{" "}
          for app information and nutrition data sources.
        </p>
      </section>

      <section aria-labelledby="settings-data-heading">
        <h2 id="settings-data-heading" className="dashboard-settings-h2">
          Data &amp; privacy
        </h2>
        <p className="dashboard-settings-p">
          Items in Trash (including expired Free recipes) are permanently deleted after{" "}
          {TRASH_RETENTION_DAYS} days. Free owned recipes also expire after{" "}
          {FREE_RECIPE_TTL_DAYS} days and move to Trash automatically. This page does not
          delete your Clerk account.
        </p>
      </section>

      <TrashRestoreSection
        initialFolders={foldersRes.data}
        initialRecipes={recipesRes.data}
        listError={listError}
      />
    </div>
  );
}
