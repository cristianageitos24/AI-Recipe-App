import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTrashedFolders } from "@/app/actions/folders";
import { getTrashedRecipes } from "@/app/actions/recipes";
import { getMyEntitlements } from "@/app/actions/entitlements";
import { FREE_RECIPE_TTL_DAYS } from "@/lib/entitlements";
import { TRASH_RETENTION_DAYS } from "@/lib/trash-retention";
import { ProPill } from "@/components/ProPill";
import { OpenAccountButton } from "./OpenAccountButton";
import { TrashRestoreSection } from "./TrashRestoreSection";
import "@/app/styling/SettingsPage.css";

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

function PrivacyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="settings-row-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

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
  const isPro = entitlements?.isPro ?? false;
  const used = entitlements?.extractionsUsed ?? 0;
  const limit = entitlements?.extractionsLimit ?? 3;
  const usagePct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className="dashboard-settings">
      <header className="settings-header">
        <h1 className="dashboard-settings-title">Settings</h1>
        <p className="settings-header-sub">
          Manage your account, plan, and deleted recipes.
        </p>
      </header>

      <div className="settings-stack">
        <section className="settings-panel" aria-labelledby="settings-account-heading">
          <div className="settings-panel-head">
            <span className="settings-panel-icon settings-panel-icon--blue">
              <AccountIcon />
            </span>
            <div>
              <h2 id="settings-account-heading" className="dashboard-settings-h2">
                Account
              </h2>
              <p className="settings-panel-desc">
                Profile, email, password, and security settings.
              </p>
            </div>
          </div>
          <div className="settings-panel-actions">
            <OpenAccountButton />
          </div>
        </section>

        <section className="settings-panel settings-panel--plan" aria-labelledby="settings-plan-heading">
          <div className="settings-panel-head">
            <span className="settings-panel-icon settings-panel-icon--red">
              <PlanIcon />
            </span>
            <div className="settings-plan-head-text">
              <div className="settings-plan-title-row">
                <h2 id="settings-plan-heading" className="dashboard-settings-h2">
                  Your plan
                </h2>
                {isPro ? (
                  <ProPill />
                ) : (
                  <span className="settings-plan-badge settings-plan-badge--free">Free</span>
                )}
              </div>
              <p className="settings-panel-desc">
                {isPro
                  ? "Unlimited extractions, permanent recipes, meal planning, and grocery lists."
                  : `Free recipes expire after ${FREE_RECIPE_TTL_DAYS} days. Upgrade for unlimited access.`}
              </p>
            </div>
          </div>

          {!isPro ? (
            <div className="settings-usage" aria-label="Extractions this month">
              <div className="settings-usage-meta">
                <span>Extractions this month</span>
                <span className="settings-usage-count">
                  {used} / {limit}
                </span>
              </div>
              <div
                className="settings-usage-track"
                role="progressbar"
                aria-valuenow={used}
                aria-valuemin={0}
                aria-valuemax={limit}
              >
                <div
                  className="settings-usage-fill"
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="settings-panel-actions">
            <Link
              href="/dashboard/billing"
              className={
                isPro
                  ? "settings-btn settings-btn--secondary"
                  : "settings-btn settings-btn--primary"
              }
            >
              {isPro ? "Manage billing" : "Upgrade to Pro"}
            </Link>
            {!isPro ? (
              <Link href="/dashboard/billing" className="settings-text-link">
                Compare plans &amp; invoices
              </Link>
            ) : null}
          </div>
        </section>

        <section className="settings-panel" aria-labelledby="settings-about-heading">
          <div className="settings-panel-head">
            <span className="settings-panel-icon settings-panel-icon--green">
              <HelpIcon />
            </span>
            <div>
              <h2 id="settings-about-heading" className="dashboard-settings-h2">
                About &amp; help
              </h2>
              <p className="settings-panel-desc">
                App information and nutrition data sources.
              </p>
            </div>
          </div>
          <Link href="/dashboard/about" className="settings-row-link">
            <span>Open About page</span>
            <ChevronIcon />
          </Link>
        </section>

        <section className="settings-panel" aria-labelledby="settings-data-heading">
          <div className="settings-panel-head">
            <span className="settings-panel-icon settings-panel-icon--muted">
              <PrivacyIcon />
            </span>
            <div>
              <h2 id="settings-data-heading" className="dashboard-settings-h2">
                Data &amp; privacy
              </h2>
              <p className="settings-panel-desc">
                Items in Trash are permanently deleted after {TRASH_RETENTION_DAYS} days.
                {!isPro
                  ? ` Free recipes expire after ${FREE_RECIPE_TTL_DAYS} days and move to Trash automatically.`
                  : null}{" "}
                This page does not delete your Clerk account.
              </p>
            </div>
          </div>
        </section>

        <TrashRestoreSection
          initialFolders={foldersRes.data}
          initialRecipes={recipesRes.data}
          listError={listError}
        />
      </div>
    </div>
  );
}
