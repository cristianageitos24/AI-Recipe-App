import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import {
  SITE_DESCRIPTION,
  SITE_EMAIL,
  SITE_LOGO_PATH,
  SITE_NAME,
  SITE_URL,
  sitePath,
} from "@/lib/site";
import "@/app/styling/LandingPage.css";

export const metadata: Metadata = {
  title: { absolute: SITE_NAME },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

const FEATURES = [
  {
    title: "Search your kitchen",
    body: "Look up recipes in your library and curated collections so dinner starts from what you actually want to cook.",
    icon: "/images/searchicon.svg",
  },
  {
    title: "Cookbooks",
    body: "Save recipes into folders you name yourself, then open them later from your cookbook instead of hunting through notes.",
    icon: "/images/dashboard/cookbook-icon.svg",
  },
  {
    title: "Meal calendar",
    body: "Plan what you will cook across the week. Meal calendar is included with HomeRecipe Pro.",
    icon: "/images/dashboard/calendaricon.svg",
  },
  {
    title: "Grocery list",
    body: "Turn planned meals into a shopping list. Grocery list is included with HomeRecipe Pro.",
    icon: "/images/dashboard/groceryicon.svg",
  },
  {
    title: "Import from a URL",
    body: "Paste a recipe webpage and HomeRecipe extracts the title, ingredients, and steps so you can save it.",
    icon: "/images/dashboard/openrecipe.svg",
  },
  {
    title: "Video recipes",
    body: "Upload a cooking video or submit a supported video URL. HomeRecipe extracts a structured recipe you can edit and keep.",
    icon: "/images/dashboard/videouploadicon.svg",
  },
] as const;

const STEPS = [
  {
    title: "Create an account",
    body: "Sign up on the web. The same account works with the HomeRecipe iOS app.",
  },
  {
    title: "Add recipes",
    body: "Import from a URL or video, create a recipe yourself, or save from the recipe library.",
  },
  {
    title: "Plan the week",
    body: "Organize cookbooks, put meals on the calendar, and build a grocery list when you are ready to shop.",
  },
] as const;

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: sitePath(SITE_LOGO_PATH),
        email: SITE_EMAIL,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };

  return (
    <div className="landing-page">
      <JsonLd data={jsonLd} />
      <header className="landing-header">
        <Link href="/" className="landing-brand">
          <Image
            src={SITE_LOGO_PATH}
            alt=""
            width={36}
            height={45}
            className="landing-logo"
            priority
          />
          <span className="landing-brand-name">{SITE_NAME}</span>
        </Link>
        <div className="landing-header-actions">
          <Link href="/signin" className="landing-btn landing-btn-ghost">
            Sign in
          </Link>
          <Link href="/signup" className="landing-btn landing-btn-primary">
            Create account
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-inner landing-hero">
          <div>
            <p className="landing-kicker">Web and iOS</p>
            <h1 className="landing-hero-title">
              Simple and tasty recipes, saved in one place.
            </h1>
            <p className="landing-hero-lede">
              {SITE_DESCRIPTION} Import from a webpage or a cooking video,
              organize cookbooks, and plan meals — then cook from your own
              library.
            </p>
            <div className="landing-ctas">
              <Link href="/signup" className="landing-btn landing-btn-primary">
                Create a free account
              </Link>
              <Link href="/signin" className="landing-btn landing-btn-secondary">
                Sign in
              </Link>
            </div>
          </div>
          <div className="landing-hero-visual">
            <Image
              src="/images/version1/food pictures/joseph-gonzalez-zcUgjyqEwe8-unsplash.jpg"
              alt="A plated breakfast of toast, banana, and berries"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
              className="landing-hero-image"
            />
            <p className="landing-hero-caption">
              Keep the recipes you cook, without losing them across tabs and
              videos.
            </p>
          </div>
        </section>

        <section className="landing-inner landing-section" aria-labelledby="features-heading">
          <h2 id="features-heading" className="landing-section-title">
            Everything you need to cook from your recipes
          </h2>
          <p className="landing-section-lede">
            HomeRecipe is a signed-in kitchen app. Your recipes, cookbooks,
            calendar, and grocery list stay in your account.
          </p>
          <div className="landing-feature-grid">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="landing-feature">
                <Image
                  src={feature.icon}
                  alt=""
                  width={28}
                  height={28}
                  className="landing-feature-icon"
                />
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-inner landing-section" aria-labelledby="nutrition-heading">
          <h2 id="nutrition-heading" className="landing-section-title">
            Nutrition when you need it
          </h2>
          <p className="landing-section-lede">
            Where the app shows ingredient or recipe nutrition, it is derived
            from USDA FoodData Central, a public-domain U.S. Government dataset.
            Full nutrients and macros are included with HomeRecipe Pro.
          </p>
        </section>

        <section className="landing-inner landing-section" aria-labelledby="how-heading">
          <h2 id="how-heading" className="landing-section-title">
            How it works
          </h2>
          <div className="landing-steps">
            {STEPS.map((step, index) => (
              <article key={step.title} className="landing-step">
                <span className="landing-step-num">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-inner">
          <div className="landing-cta-band">
            <div>
              <h2>Start cooking with HomeRecipe</h2>
              <p>
                Create an account to save recipes, or sign in if you already
                have one. Free accounts can import a limited number of recipes
                each month. Pro unlocks the full library, nutrition, meal
                calendar, and grocery list.
              </p>
            </div>
            <div className="landing-ctas">
              <Link href="/signup" className="landing-btn landing-btn-primary">
                Create account
              </Link>
              <Link href="/signin" className="landing-btn landing-btn-secondary">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-inner landing-footer">
        <span>© {new Date().getFullYear()} {SITE_NAME}</span>
        <nav aria-label="Footer">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/signin">Sign in</Link>
          <Link href="/signup">Create account</Link>
        </nav>
      </footer>
    </div>
  );
}
