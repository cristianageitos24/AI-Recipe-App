import Link from "next/link";

interface FolderWithCount {
  folderName: string;
  count: number;
}

export function HomeCollectionsPanel({ foldersWithCounts }: { foldersWithCounts: FolderWithCount[] }) {
  return (
    <section className="home-surface-card home-collections-panel">
      <div className="home-collections-header">
        <div>
          <div className="home-collections-title-row">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--brand-blue)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="home-collections-icon"
              aria-hidden="true"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <h2 className="home-section-title">Your Collections</h2>
          </div>
          <p className="home-section-caption">Quick access to your saved collections</p>
        </div>
        <Link href="/dashboard/cookbook" className="home-view-all-btn">View all</Link>
      </div>
      <div className="home-collections-grid">
        {foldersWithCounts.length > 0 ? (
          foldersWithCounts.map((f) => (
            <Link
              key={f.folderName}
              href={`/dashboard/cookbook/${encodeURIComponent(f.folderName)}`}
              className="home-collection-card"
            >
              <p className="home-collection-name">{f.folderName}</p>
              <p className="home-collection-count">{f.count}</p>
            </Link>
          ))
        ) : (
          <p className="home-section-empty">
            Create folders in Cookbooks to organize your recipes.
          </p>
        )}
      </div>
    </section>
  );
}
