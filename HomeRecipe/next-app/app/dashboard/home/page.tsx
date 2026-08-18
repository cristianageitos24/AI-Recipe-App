"use client";

import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import { useUser } from "@clerk/nextjs";
import { useState } from "react";
import { motion } from "framer-motion";
import { RecipeFullView } from "@/components/RecipeFullView";
import { SaveRecipeToCookbookModal } from "@/components/SaveRecipeToCookbookModal";
import { FreePlanBanner } from "@/components/FreePlanBanner";
import { ProLockedRecipeCard } from "@/components/ProLockedRecipeCard";
import { ProPill } from "@/components/ProPill";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useEntitlements } from "@/components/EntitlementsProvider";
import type { PlanLimitReason } from "@/lib/entitlements-constants";
import { useHomeData } from "./_hooks/useHomeData";
import { useHomeSearch } from "./_hooks/useHomeSearch";
import { HomeSearchShell } from "./_components/HomeSearchShell";
import { HomeStatCards } from "./_components/HomeStatCards";
import { HomeImportCard } from "./_components/HomeImportCard";
import { HomeCollectionsPanel } from "./_components/HomeCollectionsPanel";
import { HomeUpcomingPanel } from "./_components/HomeUpcomingPanel";
import "@/app/styling/TabHome.css";
import "@/app/styling/VideoUpload.css";
import "@/app/styling/CookbookFolderPage.css";
import "@/app/styling/CookbookPageRecipeCard.css";
import "@/app/styling/UpgradePrompt.css";
import "@/app/styling/mobile/home.css";
import "@/app/styling/mobile/recipe-cards.css";
import "@/app/styling/mobile/create-import.css";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
  style: ["normal"],
  display: "swap",
});

export default function DashboardHomePage() {
  const { user } = useUser();
  const firstName = user?.firstName ?? "there";
  const { entitlements, refreshEntitlements } = useEntitlements();
  const [upgradeReason, setUpgradeReason] = useState<PlanLimitReason | null>(null);

  const {
    foldersWithCounts,
    isHomeDataLoading,
    isCollectionsLoading,
    homeStats,
    upcomingMealPlans,
    favoriteIds,
    handleFavoriteChange,
    suggestedRecipes,
  } = useHomeData();

  const search = useHomeSearch({
    onPlanLimit: (reason) => setUpgradeReason(reason),
    onExtractSuccess: () => void refreshEntitlements(),
  });

  return (
    <div className="main-panel home-main-panel">
      <motion.div
        className="recipe-search-content"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <FreePlanBanner />
        <HomeSearchShell
          {...search}
          favoriteIds={favoriteIds}
          onFavoriteChange={handleFavoriteChange}
          webSearchLocked={!entitlements.isPro}
          onWebSearchLocked={() => setUpgradeReason("catalog")}
        />

        {/* Welcome row */}
        <div className="home-welcome-row">
          <div>
            <h1
              className={`home-welcome-heading ${playfairDisplay.className}`}
              style={{
                fontWeight: 800,
                fontOpticalSizing: "auto",
              }}
            >
              Welcome back, {firstName} <span style={{ marginLeft: "4px" }}>👋</span>
            </h1>
            <p className="home-welcome-sub">
              {entitlements.isPro
                ? "Let's make today delicious."
                : `Free plan · ${entitlements.extractionsRemaining} of ${entitlements.extractionsLimit} extractions left this month.`}
            </p>
          </div>
          <Link href="/dashboard/create-recipe" className="home-create-recipe-btn">
            <span aria-hidden>+</span> Create Recipe
          </Link>
        </div>

        <HomeStatCards
          stats={homeStats}
          isLoading={isHomeDataLoading}
          onOpenSearch={openSearch}
        />

        <HomeImportCard
          onWebRecipeUrlImport={search.importRecipeFromWebUrl}
          extractionsRemaining={entitlements.isPro ? null : entitlements.extractionsRemaining}
          onExtractionBlocked={() => setUpgradeReason("extractions")}
        />

        {!entitlements.isPro && suggestedRecipes.length > 0 ? (
          <section className="home-surface-card" style={{ marginBottom: "1rem", padding: "1rem" }}>
            <h2 className="home-section-title pro-pill-inline">
              Recipe Library
              <ProPill />
            </h2>
            <p className="home-section-caption">
              Upgrade to open the full catalog. Tap a card to unlock.
            </p>
            <div className="pro-locked-strip">
              {suggestedRecipes.slice(0, 8).map((recipe) => (
                <ProLockedRecipeCard
                  key={recipe.recipe_id}
                  recipe={recipe}
                  onUnlock={() => setUpgradeReason("catalog")}
                />
              ))}
            </div>
          </section>
        ) : null}

        <div className="home-lower-grid">
          <HomeCollectionsPanel foldersWithCounts={foldersWithCounts} isLoading={isCollectionsLoading} />
          <HomeUpcomingPanel upcomingMealPlans={upcomingMealPlans} isLoading={isHomeDataLoading} />
        </div>
      </motion.div>

      <UpgradePrompt
        open={upgradeReason !== null}
        reason={upgradeReason ?? "catalog"}
        onClose={() => setUpgradeReason(null)}
      />

      {/* URL import preview overlay */}
      {search.showUrlPreviewModal && search.urlPreview && search.urlDraftRecipeRow && (
        <>
          <div
            className="recipe-full-view-overlay"
            onClick={search.closeUrlPreview}
            onKeyDown={(e) => { if (e.key === "Escape") search.closeUrlPreview(); }}
            role="button"
            tabIndex={0}
            aria-label="Close imported recipe"
          >
            <div
              className="recipe-full-view-scroll-wrapper"
              onClick={(e) => e.stopPropagation()}
            >
              <RecipeFullView
                recipeData={search.urlDraftRecipeRow}
                primaryActionSlot={
                  <button
                    type="button"
                    className="submit-button video-recipe-save-btn"
                    style={{ margin: 0 }}
                    disabled={!search.urlImportCanSave}
                    onClick={() => search.setUrlSaveModalOpen(true)}
                  >
                    Save
                  </button>
                }
                onClose={search.closeUrlPreview}
              />
            </div>
          </div>
          <SaveRecipeToCookbookModal
            open={search.urlSaveModalOpen}
            onClose={() => search.setUrlSaveModalOpen(false)}
            payload={
              search.urlSaveModalOpen && search.urlImportPayload
                ? search.urlImportPayload
                : null
            }
          />
        </>
      )}
    </div>
  );
}
