import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SITE_EMAIL, SITE_LOGO_PATH, sitePath } from "@/lib/site";
import "@/app/styling/LegalPage.css";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Get help with HomeRecipe — contact us, troubleshoot imports and subscriptions, or delete your account.",
  alternates: {
    canonical: sitePath("/support"),
  },
  openGraph: {
    title: "Support",
    description:
      "Get help with HomeRecipe — contact us, troubleshoot imports and subscriptions, or delete your account.",
    url: sitePath("/support"),
    siteName: "HomeRecipe",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Support · HomeRecipe",
    description:
      "Get help with HomeRecipe — contact us, troubleshoot imports and subscriptions, or delete your account.",
  },
};

const LAST_UPDATED = "September 13, 2026";
const CONTACT_EMAIL = SITE_EMAIL;

export default function SupportPage() {
  return (
    <main className="legal-page">
      <div className="legal-page-inner">
        <header className="legal-brand">
          <Link href="/" className="legal-brand-row">
            <Image
              src={SITE_LOGO_PATH}
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

        <h1 className="legal-title">Support</h1>
        <p className="legal-lede">
          Need help with HomeRecipe on the web or on iPhone? Email us and we’ll
          get back to you. Most questions below have a direct answer you can act
          on right away.
        </p>

        <nav aria-label="On this page">
          <ul className="legal-nav">
            <li>
              <a href="#contact">Contact us</a>
            </li>
            <li>
              <a href="#account">Account &amp; sign-in</a>
            </li>
            <li>
              <a href="#subscription">Subscription &amp; billing</a>
            </li>
            <li>
              <a href="#import">Recipe import</a>
            </li>
            <li>
              <a href="#delete">Delete your account</a>
            </li>
            <li>
              <a href="#privacy">Privacy requests</a>
            </li>
          </ul>
        </nav>

        <section className="legal-section" id="contact">
          <h2>Contact us</h2>
          <p>
            Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We
            aim to reply within two business days.
          </p>
          <p>
            To help us resolve things faster, include the email address on your
            account, whether you were on the website or the iOS app, and what
            you expected to happen.
          </p>
          <p>
            HomeRecipe is operated by Ageitos Digital. Postal address available
            on request by email.
          </p>
        </section>

        <section className="legal-section" id="account">
          <h2>Account and sign-in</h2>
          <p>
            HomeRecipe uses one account across the website and the iOS app. You
            can sign in with Apple, with Google, or with a code sent to your
            email address. If you originally signed up with one method, sign in
            with that same method so you land back on the same account.
          </p>
          <p>
            Not receiving the email code? Check your spam folder, then confirm
            you are entering the same address you signed up with. If it still
            does not arrive, email us.
          </p>
        </section>

        <section className="legal-section" id="subscription">
          <h2>Subscription and billing</h2>
          <ul>
            <li>
              <strong>Bought Pro on iPhone or iPad:</strong> manage or cancel in{" "}
              <a href="https://apps.apple.com/account/subscriptions">
                your Apple subscription settings
              </a>
              , or from Manage subscription in the app. Refunds for In-App
              Purchases are handled by Apple.
            </li>
            <li>
              <strong>Bought Pro on the web:</strong> manage or cancel from
              Billing in your dashboard, which opens the Stripe customer portal.
            </li>
            <li>
              <strong>Paid but Pro is not showing:</strong> open the app and use
              Restore purchases on the Account screen. If Pro still does not
              appear, email us with the Apple receipt or the email on your
              account.
            </li>
          </ul>
          <p>
            One Pro subscription unlocks Pro on both the website and the iOS app
            for the same account. See our{" "}
            <Link href="/terms">Terms of Use</Link> for renewal and cancellation
            terms.
          </p>
        </section>

        <section className="legal-section" id="import">
          <h2>Recipe import</h2>
          <p>
            Importing from a recipe webpage reads the structured recipe data the
            page publishes. Some sites do not publish it, or block automated
            readers, and those imports will fail. You can always add the recipe
            manually.
          </p>
          <p>
            Video import is automated transcription and extraction. It can
            misread quantities or skip steps, so review an imported recipe
            before cooking from it. Free accounts have a monthly extraction
            limit; Pro removes it.
          </p>
        </section>

        <section className="legal-section" id="delete">
          <h2>Delete your account</h2>
          <p>
            You can delete your account yourself, and deletion is permanent.
          </p>
          <ul>
            <li>
              <strong>iOS app:</strong> Account → Delete account.
            </li>
            <li>
              <strong>Website:</strong> Settings → Delete account.
            </li>
          </ul>
          <p>
            This removes your profile, the recipes you created, cookbooks,
            favorites, meal calendar entries, grocery lists, and uploaded images
            and videos. If you subscribe through the App Store, cancel that
            subscription with Apple as well — deleting your account does not
            stop Apple billing.
          </p>
        </section>

        <section className="legal-section" id="privacy">
          <h2>Privacy requests</h2>
          <p>
            For access, correction, or deletion requests, or any question about
            how we handle data, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Our{" "}
            <Link href="/privacy">Privacy Policy</Link> describes what we
            collect and which processors handle it.
          </p>
        </section>

        <footer className="legal-footer">
          <span>© {new Date().getFullYear()} HomeRecipe</span>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Use</Link>
          <Link href="/signin">Sign in</Link>
        </footer>
      </div>
    </main>
  );
}
