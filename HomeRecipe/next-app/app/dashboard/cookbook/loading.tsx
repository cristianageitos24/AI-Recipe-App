import { CookbookCreateCard } from "@/components/CookbookCreateCard";
import { CookbookLoadingRow } from "@/components/CookbookLoadingRow";
import "@/app/styling/TabCookbook.css";
import "@/app/styling/Cookbooks.css";
import "@/app/styling/FolderTemplate.css";

export default function Loading() {
  return (
    <div className="main-panel">
      <div className="cookbook-canvas">
        <div className="cookbook-page-header">
          <div className="cookbook-page-title-row">
            <span className="cookbook-page-title-icon" aria-hidden="true" />
            <div>
              <h1>Cookbooks</h1>
              <p>Discover, organize and save your favorite recipes.</p>
            </div>
          </div>
        </div>
        <div className="cookbook-content">
          <div className="tabcookbook-cookbooks-section">
            <div className="cookbook-section-header">
              <div className="cookbook-section-title-wrap">
                <h1 className="cookbook-subtitle">Your Cookbooks</h1>
                <span className="cookbook-count-badge cookbook-count-badge-skeleton" aria-hidden="true" />
              </div>
            </div>
            <CookbookLoadingRow createCard={<CookbookCreateCard />} />
          </div>
        </div>
      </div>
    </div>
  );
}
