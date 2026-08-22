import type { Metadata } from "next";
import Link from "next/link";
import { noIndexRobots } from "@/lib/site";
import "@/app/styling/NotFoundPage.css";

export const metadata: Metadata = {
  title: "Page not found",
  robots: noIndexRobots(),
};

export default function NotFound() {
  return (
    <main className="not-found-page">
      <p className="not-found-code">404</p>
      <h1 className="not-found-title">This page is not here.</h1>
      <p className="not-found-lede">
        The link may be incorrect, or the page may have moved.
      </p>
      <div className="not-found-actions">
        <Link href="/" className="not-found-primary">
          Back to HomeRecipe
        </Link>
        <Link href="/privacy">Privacy Policy</Link>
      </div>
    </main>
  );
}
