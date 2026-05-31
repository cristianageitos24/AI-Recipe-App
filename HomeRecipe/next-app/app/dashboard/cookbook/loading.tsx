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
              <span className="cookbook-route-skeleton-line cookbook-route-skeleton-title" aria-hidden="true" />
              <span className="cookbook-route-skeleton-line cookbook-route-skeleton-subtitle" aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className="cookbook-content">
          <div className="tabcookbook-cookbooks-section">
            <div className="cookbook-section-header">
              <div className="cookbook-section-title-wrap">
                <span className="cookbook-route-skeleton-line cookbook-route-skeleton-section-title" aria-hidden="true" />
                <span className="cookbook-count-badge cookbook-count-badge-skeleton" aria-hidden="true" />
              </div>
            </div>
            <CookbookLoadingRow
              createCard={
                <div className="cookbook-user-folder cookbook-user-folder-skeleton" aria-hidden="true" />
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
