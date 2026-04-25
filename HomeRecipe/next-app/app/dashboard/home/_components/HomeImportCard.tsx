import Image from "next/image";
import { VideoUploadForm } from "@/components/VideoUploadForm";

interface HomeImportCardProps {
  onWebRecipeUrlImport: (url: string) => Promise<void>;
}

export function HomeImportCard({ onWebRecipeUrlImport }: HomeImportCardProps) {
  return (
    <section className="home-surface-card home-import-card">
      <div className="home-import-content">
        <div className="home-import-icon-circle" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
        <h2 className="home-section-title">Import a Recipe</h2>
        <p className="home-section-caption">
          Paste a TikTok link or any recipe webpage URL and we&apos;ll do the rest.
        </p>
      </div>
      <div className="home-import-form">
        <VideoUploadForm
          variant="embedded-unified"
          onWebRecipeUrlImport={onWebRecipeUrlImport}
        />
      </div>
      <div className="home-import-decoration" aria-hidden="true">
        <Image
          src="/images/dashboard/salad_stock.png"
          alt=""
          width={220}
          height={220}
          className="home-import-decoration-img"
        />
      </div>
    </section>
  );
}
