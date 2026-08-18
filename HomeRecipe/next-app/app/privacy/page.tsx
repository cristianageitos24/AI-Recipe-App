import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "@/app/styling/LegalPage.css";

export const metadata: Metadata = {
  title: "Privacy Policy · HomeRecipe",
  description:
    "How HomeRecipe collects, uses, and shares information for the website and iOS app.",
  alternates: {
    canonical: "https://homerecipe.co/privacy",
  },
};

const LAST_UPDATED = "August 8, 2026";
const CONTACT_EMAIL = "cristian@ageitosdigital.com";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-page-inner">
        <header className="legal-brand">
          <Link href="/signin" className="legal-brand-row">
            <Image
              src="/images/homerecipelogo1.png"
              alt=""
              width={36}
              height={45}
              className="legal-logo"
              priority
            />
            <p className="legal-brand-name">HomeRecipe</p>
          </Link>
          <p className="legal-updated">Last updated: {LAST_UPDATED}</p>
        </header>

        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-lede">
          This Privacy Policy describes how HomeRecipe (“we,” “us,” or “our”)
          collects, uses, stores, and shares information when you use our
          website at{" "}
          <a href="https://homerecipe.co">https://homerecipe.co</a> and our iOS
          app (bundle ID{" "}
          <code>com.ageitosdigital.homerecipe</code>). The website and app share
          the same account system and backend, so most practices below apply to
          both.
        </p>

        <nav aria-label="On this page">
          <ul className="legal-nav">
            <li>
              <a href="#collect">What we collect</a>
            </li>
            <li>
              <a href="#use">How we use it</a>
            </li>
            <li>
              <a href="#share">Sharing &amp; processors</a>
            </li>
            <li>
              <a href="#ai">AI &amp; import</a>
            </li>
            <li>
              <a href="#cookies">Cookies &amp; device storage</a>
            </li>
            <li>
              <a href="#retention">Retention</a>
            </li>
            <li>
              <a href="#rights">Your rights</a>
            </li>
            <li>
              <a href="#contact">Contact</a>
            </li>
          </ul>
        </nav>

        <section className="legal-section" id="collect">
          <h2>1. Information we collect</h2>
          <p>
            We collect information you provide, information created when you use
            the Service, and limited technical information needed to operate the
            Service. We do not sell your personal information, and we do not use
            advertising SDKs or third-party marketing pixels in the app or site
            as built today.
          </p>

          <h3>Account and profile</h3>
          <ul>
            <li>
              <strong>Account identifiers:</strong> Clerk user ID, email address,
              and username (derived from your account).
            </li>
            <li>
              <strong>Name:</strong> name associated with your Clerk account;
              optional display name you set in profile settings (synced with the
              mobile app).
            </li>
            <li>
              <strong>Optional profile fields:</strong> phone number and
              birthday, if you choose to add them in settings.
            </li>
            <li>
              <strong>Authentication data:</strong> session and sign-in
              information managed by Clerk (including social or email sign-in
              you choose through Clerk).
            </li>
          </ul>

          <h3>Content you create or import</h3>
          <ul>
            <li>
              Recipes (titles, ingredients, steps, timing, source URLs, notes,
              nutrition-related fields we derive or you confirm).
            </li>
            <li>Cookbooks/folders, favorites, meal calendar plans, and grocery lists.</li>
            <li>
              Recipe cover and folder cover <strong>images</strong> you upload.
            </li>
            <li>
              <strong>Videos</strong> you upload (for example MP4) or video URLs
              you submit (currently TikTok URL import where supported), plus
              related job metadata such as transcripts, OCR text, thumbnails,
              and extracted recipe drafts.
            </li>
          </ul>

          <h3>Purchases and entitlements</h3>
          <ul>
            <li>
              <strong>Web subscriptions:</strong> Stripe customer and
              subscription identifiers and status (for example customer ID,
              subscription ID, price ID, subscription status) stored on your
              profile to unlock Pro features.
            </li>
            <li>
              <strong>iOS in-app purchases:</strong> Apple subscriptions managed
              through RevenueCat. We receive webhook events (for example
              purchase, renewal, expiration) keyed to your Clerk user ID and
              store entitlement fields such as plan tier, billing source, and
              whether the Apple entitlement is active. Payment card details are
              handled by Apple / Stripe — we do not store full card numbers.
            </li>
          </ul>

          <h3>Technical and usage information</h3>
          <ul>
            <li>
              Server logs and security-related request metadata as typical for
              hosting (for example IP address, timestamps, and error diagnostics
              collected by our hosting provider).
            </li>
            <li>
              Aggregated product analytics via Vercel Analytics and Speed
              Insights on the website (performance and usage metrics; not used
              to build advertising profiles).
            </li>
            <li>
              Limited on-device preferences in the browser (for example
              localStorage flags for UI dismissals or grocery category
              overrides).
            </li>
          </ul>
        </section>

        <section className="legal-section" id="use">
          <h2>2. How we use information</h2>
          <ul>
            <li>Provide, secure, and improve the Service (accounts, recipes, planning, sync across web and iOS).</li>
            <li>Authenticate you and enforce access controls (including database row-level security tied to your user ID).</li>
            <li>Process subscriptions and unlock Pro features on web (Stripe) and iOS (Apple via RevenueCat).</li>
            <li>
              Import and extract recipes from URLs or videos (including
              server-side AI processing described below).
            </li>
            <li>
              Estimate or match nutrition information using USDA FoodData Central
              data and, when needed, server-side AI estimation for unresolved
              ingredient lines.
            </li>
            <li>Respond to support or privacy requests you send us.</li>
            <li>Detect abuse, debug failures, and maintain service reliability.</li>
          </ul>
        </section>

        <section className="legal-section" id="share">
          <h2>3. How we share information (service providers)</h2>
          <p>
            We share information with processors that help us run HomeRecipe.
            They receive only what is needed for their role. We do{" "}
            <strong>not</strong> claim that we “never share data with third
            parties,” because these providers process data on our behalf:
          </p>
          <ul>
            <li>
              <strong>Clerk</strong> — authentication and account management
              (including session cookies).
            </li>
            <li>
              <strong>Supabase</strong> — database, file storage (recipe covers,
              videos), and authorization using your Clerk session.
            </li>
            <li>
              <strong>Stripe</strong> — web checkout, billing, customer portal,
              and related webhooks.
            </li>
            <li>
              <strong>RevenueCat and Apple</strong> — iOS in-app subscriptions;
              RevenueCat notifies our servers at{" "}
              <code>/api/webhooks/revenuecat</code> so we can sync Pro access.
            </li>
            <li>
              <strong>Vercel</strong> — hosting the website and related
              infrastructure, plus Analytics / Speed Insights.
            </li>
            <li>
              <strong>OpenAI</strong> — server-side processing for video
              transcription, recipe extraction from video content, and optional
              nutrition estimation when USDA matching is incomplete. Recipe
              content and related media-derived text may be sent to OpenAI for
              these features.
            </li>
            <li>
              <strong>Tavily</strong> — Pro web recipe search queries (search
              terms you enter) when that feature is used.
            </li>
            <li>
              <strong>USDA FoodData Central</strong> — server-side lookups to
              match ingredients to public nutrition data (queries are food
              descriptions / IDs, not your password).
            </li>
            <li>
              <strong>Recipe URL import service</strong> — our scraping service
              fetches public recipe pages you ask us to import (JSON-LD / HTML
              extraction; not an LLM in the current importer).
            </li>
          </ul>
          <p>
            We may also disclose information if required by law, to protect
            rights and safety, or in connection with a business transfer (for
            example a merger), subject to applicable law.
          </p>
        </section>

        <section className="legal-section" id="ai">
          <h2>4. AI and automated processing</h2>
          <p>
            Certain features send content to AI providers{" "}
            <strong>on our servers</strong> (not in your browser):
          </p>
          <ul>
            <li>
              Video recipe import: audio transcription (Whisper), OCR of on-screen
              text (Tesseract), optional analysis of selected video frames by an
              OpenAI vision model to identify visible foods and ingredient labels,
              and structured recipe extraction from that combined evidence.
            </li>
            <li>
              Nutrition: when an ingredient line cannot be confidently matched to
              USDA data, we may use an OpenAI model to estimate macros or suggest
              a match.
            </li>
            <li>
              Frame images used for vision analysis are processed transiently on
              our servers and are not retained as a permanent gallery of your
              videos beyond job metadata needed to run the feature.
            </li>
          </ul>
          <p>
            Static webpage URL import scrapes structured recipe data from the
            page you provide; that importer does not currently call an LLM. We
            do not use your content to train our own foundation models. OpenAI’s
            processing is subject to OpenAI’s terms and data policies for API
            customers.
          </p>
        </section>

        <section className="legal-section" id="cookies">
          <h2>5. Cookies and local storage</h2>
          <p>
            Authentication cookies and session material are managed by{" "}
            <strong>Clerk</strong>. We do not create a separate custom auth
            cookie, and we do not store passwords in cookies. The website may
            also use browser <strong>localStorage</strong> for non-essential UI
            preferences (for example dismissing a banner or remembering grocery
            category overrides on that device).
          </p>
        </section>

        <section className="legal-section" id="retention">
          <h2>6. Retention</h2>
          <ul>
            <li>
              Account and profile data are kept while your account remains
              active.
            </li>
            <li>
              Free-tier user recipes generally expire after{" "}
              <strong>30 days</strong> and move to Trash unless you upgrade.
            </li>
            <li>
              Items in Trash are permanently deleted after{" "}
              <strong>7 days</strong>.
            </li>
            <li>
              Meal calendar entries older than about{" "}
              <strong>90 days</strong> are purged by scheduled cleanup.
            </li>
            <li>
              Billing and entitlement records are retained as needed to provide
              Pro access, prevent fraud, and meet legal/accounting requirements.
            </li>
            <li>
              Video processing jobs and stored media are retained to provide the
              feature and for operational debugging; you can delete associated
              recipes/content in-product where available.
            </li>
          </ul>
        </section>

        <section className="legal-section" id="security">
          <h2>7. Security</h2>
          <p>
            We use industry-standard protections appropriate to our stack,
            including HTTPS in production, Clerk-managed authentication,
            Supabase access controls (including row-level security keyed to your
            Clerk user ID), and secret keys kept on the server. No method of
            transmission or storage is 100% secure.
          </p>
        </section>

        <section className="legal-section" id="children">
          <h2>8. Children’s privacy</h2>
          <p>
            HomeRecipe is not directed to children under 13, and we do not
            knowingly collect personal information from children under 13. If
            you believe a child has provided us information, contact us and we
            will take appropriate steps to delete it.
          </p>
        </section>

        <section className="legal-section" id="rights">
          <h2>9. Your choices and rights</h2>
          <ul>
            <li>
              <strong>Access and update:</strong> you can view and edit optional
              profile fields in Settings, and manage password/security through
              Clerk account management.
            </li>
            <li>
              <strong>Delete content:</strong> you can delete recipes and
              cookbooks in the product (Trash retains them briefly, then
              permanent deletion).
            </li>
            <li>
              <strong>Account deletion:</strong> the in-app Settings page does
              not by itself delete your Clerk account. To delete your account and
              associated personal data, use Clerk account controls where
              available and/or email us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will
              help delete or de-identify account data we control, subject to
              legal retention needs (for example billing records).
            </li>
            <li>
              <strong>Marketing:</strong> we do not run an in-product marketing
              email list in the current codebase. If that changes, we will update
              this policy.
            </li>
            <li>
              <strong>Depending on your location</strong> (for example EEA/UK or
              California), you may have rights to request access, correction,
              deletion, or information about sharing. We do not sell personal
              information. To exercise rights, contact{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </li>
          </ul>
        </section>

        <section className="legal-section" id="international">
          <h2>10. International transfers</h2>
          <p>
            We and our processors (including Clerk, Supabase, Stripe, RevenueCat,
            OpenAI, Tavily, and Vercel) may process data in the United States and
            other countries. If you use HomeRecipe from elsewhere, your
            information may be transferred to those locations. Where required, we
            rely on appropriate safeguards offered by those providers.
          </p>
        </section>

        <section className="legal-section" id="changes">
          <h2>11. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will post the
            updated version at{" "}
            <a href="https://homerecipe.co/privacy">
              https://homerecipe.co/privacy
            </a>{" "}
            and revise the “Last updated” date above. Continued use of the
            Service after changes means you accept the updated policy.
          </p>
        </section>

        <section className="legal-section" id="contact">
          <h2>12. Contact</h2>
          <p>
            Questions or privacy requests:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
          <p>
            Service: HomeRecipe · Website:{" "}
            <a href="https://homerecipe.co">https://homerecipe.co</a>
          </p>
        </section>

        <footer className="legal-footer">
          <span>© {new Date().getFullYear()} HomeRecipe</span>
          <Link href="/signin">Sign in</Link>
          <Link href="/signup">Create account</Link>
        </footer>
      </div>
    </main>
  );
}
