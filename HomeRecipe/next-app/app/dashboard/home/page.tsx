"use client";

import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { RecipeFullView } from "@/components/RecipeFullView";
import { SaveRecipeToCookbookModal } from "@/components/SaveRecipeToCookbookModal";
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

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
  style: ["normal"],
  display: "swap",
});

export default function DashboardHomePage() {
  const { user } = useUser();
  const firstName = user?.firstName ?? "there";

  const {
    foldersWithCounts,
    isHomeDataLoading,
    isCollectionsLoading,
    homeStats,
    upcomingMealPlans,
    favoriteIds,
    handleFavoriteChange,
  } = useHomeData();

  const search = useHomeSearch();
  const openSearch = () => {
    search.setSearchModalOpen(true);
    window.requestAnimationFrame(() => search.inputRef.current?.focus());
  };

  return (
    <div className="main-panel home-main-panel">
      <motion.div
        className="recipe-search-content"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <HomeSearchShell
          {...search}
          favoriteIds={favoriteIds}
          onFavoriteChange={handleFavoriteChange}
        />

        {/* Welcome row */}
        <div className="home-welcome-row">
          <div>
            <h1
              className="home-welcome-heading"
              style={{
                fontFamily: playfairDisplay.style.fontFamily,
                fontWeight: 800,
                fontSize: "28px",
                fontOpticalSizing: "auto",
              }}
            >
              Welcome back, {firstName} <span style={{ marginLeft: "4px" }}>👋</span>
            </h1>
            <p className="home-welcome-sub">Let&apos;s make today delicious.</p>
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

        <HomeImportCard onWebRecipeUrlImport={search.importRecipeFromWebUrl} />

        <div className="home-lower-grid">
          <HomeCollectionsPanel foldersWithCounts={foldersWithCounts} isLoading={isCollectionsLoading} />
          <HomeUpcomingPanel upcomingMealPlans={upcomingMealPlans} isLoading={isHomeDataLoading} />
        </div>
      </motion.div>

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
