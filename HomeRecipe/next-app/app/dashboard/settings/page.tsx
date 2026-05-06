import Link from "next/link";
import { getTrashedFolders } from "@/app/actions/folders";
import { getTrashedRecipes } from "@/app/actions/recipes";
import { TRASH_RETENTION_DAYS } from "@/lib/trash-retention";
import { TrashRestoreSection } from "./TrashRestoreSection";
import "@/app/styling/SettingsPage.css";

export default async function SettingsPage() {
  const [foldersRes, recipesRes] = await Promise.all([
    getTrashedFolders(),
    getTrashedRecipes(),
  ]);

  const listError =
    [foldersRes.error, recipesRes.error].filter(Boolean).join(" · ") || null;

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
          Items in Trash are permanently deleted after {TRASH_RETENTION_DAYS} days (automatic
          server job). This page does not delete your Clerk account.
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
