import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  PLAN_PRICE_PRO_MONTHLY,
  PLAN_PRICE_PRO_YEARLY,
} from "@/lib/plan-features";
import {
  FREE_EXTRACTION_LIMIT,
  FREE_RECIPE_TTL_DAYS,
} from "@/lib/entitlements-constants";
import { SITE_EMAIL, SITE_LOGO_PATH, sitePath } from "@/lib/site";
import "@/app/styling/LegalPage.css";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms that govern your use of the HomeRecipe website and iOS app, including subscriptions.",
  alternates: {
    canonical: sitePath("/terms"),
  },
  openGraph: {
    title: "Terms of Use",
    description:
      "The terms that govern your use of the HomeRecipe website and iOS app, including subscriptions.",
    url: sitePath("/terms"),
    siteName: "HomeRecipe",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Use · HomeRecipe",
    description:
      "The terms that govern your use of the HomeRecipe website and iOS app, including subscriptions.",
  },
};

const LAST_UPDATED = "September 13, 2026";
const CONTACT_EMAIL = SITE_EMAIL;

export default function TermsPage() {
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

        <h1 className="legal-title">Terms of Use</h1>
        <p className="legal-lede">
          These Terms of Use (“Terms”) are an agreement between you and
          HomeRecipe (“we,” “us,” or “our”) covering our website at{" "}
          <a href="https://homerecipe.co">https://homerecipe.co</a> and our iOS
          app (bundle ID{" "}
          <code>com.ageitosdigital.homerecipe</code>). The website and app share
          one account and one backend, so these Terms apply to both. By creating
          an account or using HomeRecipe, you agree to these Terms.
        </p>

        <nav aria-label="On this page">
          <ul className="legal-nav">
            <li>
              <a href="#account">Your account</a>
            </li>
            <li>
              <a href="#subscriptions">Subscriptions &amp; billing</a>
            </li>
            <li>
              <a href="#cancel">Cancelling &amp; refunds</a>
            </li>
            <li>
              <a href="#content">Your content</a>
            </li>
            <li>
              <a href="#acceptable">Acceptable use</a>
            </li>
            <li>
              <a href="#nutrition">Nutrition &amp; AI</a>
            </li>
            <li>
              <a href="#termination">Termination</a>
            </li>
            <li>
              <a href="#contact">Contact</a>
            </li>
          </ul>
        </nav>

        <section className="legal-section" id="account">
          <h2>1. Your account</h2>
          <p>
            HomeRecipe is an account-based service: your recipes, cookbooks,
            meal calendar, and grocery list are stored against your account so
            they sync between the website and the iOS app. Accounts are created
            and secured through Clerk, and you are responsible for keeping
            access to your sign-in method secure.
          </p>
          <p>
            You must be at least 13 years old to use HomeRecipe. You may delete
            your account at any time — see{" "}
            <a href="#termination">Termination</a> below.
          </p>
        </section>

        <section className="legal-section" id="subscriptions">
          <h2>2. Subscriptions and billing</h2>
          <p>
            HomeRecipe offers a Free tier and an auto-renewing paid subscription
            called <strong>HomeRecipe Pro</strong>.
          </p>
          <ul>
            <li>
              <strong>Free</strong> includes {FREE_EXTRACTION_LIMIT} URL or
              video extractions per month, and recipes you add expire after{" "}
              {FREE_RECIPE_TTL_DAYS} days.
            </li>
            <li>
              <strong>Pro</strong> removes the extraction limit, keeps your
              recipes from expiring, and unlocks full nutrition, the meal
              calendar, and grocery lists.
            </li>
          </ul>
          <p>
            Pro is offered as a monthly or yearly subscription. On the website,
            Pro is sold through Stripe at {PLAN_PRICE_PRO_MONTHLY} per month or{" "}
            {PLAN_PRICE_PRO_YEARLY} per year. In the iOS app, Pro is sold as an
            Apple In-App Purchase, and the exact price, currency, and billing
            period for your storefront are shown on the purchase screen before
            you confirm.
          </p>
          <p>
            <strong>Auto-renewal.</strong> Subscriptions renew automatically for
            the same period at the then-current price unless cancelled at least
            24 hours before the end of the current period. For In-App Purchases,
            your Apple ID account is charged at confirmation of purchase and
            again within 24 hours before the end of each period. A single Pro
            subscription unlocks Pro on both the website and the iOS app for the
            same account.
          </p>
        </section>

        <section className="legal-section" id="cancel">
          <h2>3. Cancelling and refunds</h2>
          <ul>
            <li>
              <strong>Purchased on iPhone or iPad:</strong> manage or cancel in{" "}
              <a href="https://apps.apple.com/account/subscriptions">
                your Apple subscription settings
              </a>
              , or from Manage subscription in the app. Cancellation takes
              effect at the end of the current billing period. Refunds for
              In-App Purchases are handled by Apple under their terms — we
              cannot issue them on your behalf.
            </li>
            <li>
              <strong>Purchased on the web:</strong> manage or cancel from
              Billing in your dashboard, which opens the Stripe customer portal.
            </li>
          </ul>
          <p>
            Deleting your HomeRecipe account does not automatically cancel an
            App Store subscription. Cancel the subscription with Apple as well,
            or billing will continue.
          </p>
        </section>

        <section className="legal-section" id="content">
          <h2>4. Your content</h2>
          <p>
            You keep ownership of the recipes, images, videos, notes, and lists
            you add to HomeRecipe. You grant us only the permission we need to
            operate the Service for you — storing your content, displaying it
            back to you across your devices, and processing it to deliver
            features you ask for, such as extracting a recipe from a URL or
            video you submit.
          </p>
          <p>
            You are responsible for having the right to submit what you upload
            or import. Do not use HomeRecipe to reproduce or redistribute
            content you do not have the right to use. Recipe import is intended
            for saving recipes for your own personal use.
          </p>
        </section>

        <section className="legal-section" id="acceptable">
          <h2>5. Acceptable use</h2>
          <ul>
            <li>
              Do not attempt to access another user’s account or data, or bypass
              the access controls that keep accounts separate.
            </li>
            <li>
              Do not abuse the import, extraction, or search features — for
              example by automating bulk requests or attempting to evade plan
              limits.
            </li>
            <li>
              Do not upload unlawful content, malware, or content that infringes
              someone else’s rights.
            </li>
            <li>
              Do not resell, sublicense, or redistribute the Service or data
              obtained through it.
            </li>
          </ul>
        </section>

        <section className="legal-section" id="nutrition">
          <h2>6. Nutrition information and AI features</h2>
          <p>
            Where HomeRecipe shows nutrition information, it is derived from
            USDA FoodData Central and, when an ingredient cannot be matched
            confidently, may be estimated by an AI model. Nutrition values are
            approximate and are provided for general information only.{" "}
            <strong>
              They are not medical, dietary, or allergen advice, and you should
              not rely on them for medical decisions or to determine whether a
              food is safe for an allergy or medical condition.
            </strong>{" "}
            Always check the actual ingredients and packaging, and consult a
            qualified professional for dietary or medical guidance.
          </p>
          <p>
            Recipe extraction from webpages and videos is automated. It can
            misread quantities, omit steps, or produce incomplete results. Review
            an imported recipe before you cook from it.
          </p>
        </section>

        <section className="legal-section" id="availability">
          <h2>7. Availability and changes</h2>
          <p>
            We may add, change, or remove features, and we may set or adjust
            limits needed to keep the Service reliable. If we make a material
            change to a paid feature, we will make the change apply from your
            next renewal where practical. We may update these Terms; the updated
            version is posted at{" "}
            <a href="https://homerecipe.co/terms">https://homerecipe.co/terms</a>{" "}
            with a revised “Last updated” date, and continued use after that
            means you accept the update.
          </p>
        </section>

        <section className="legal-section" id="termination">
          <h2>8. Termination and account deletion</h2>
          <p>
            You can delete your account at any time — in the iOS app from
            Account, or on the website from Settings. Deletion is permanent. It
            removes your profile, recipes you created, cookbooks, favorites,
            meal calendar entries, grocery lists, uploaded images and videos,
            and your sign-in record, except where we are required to retain
            limited records (for example billing and tax records). As noted
            above, cancel any App Store subscription with Apple separately.
          </p>
          <p>
            We may suspend or terminate an account that violates these Terms or
            that we reasonably believe is being used to harm the Service or
            other users.
          </p>
        </section>

        <section className="legal-section" id="disclaimers">
          <h2>9. Disclaimers and limitation of liability</h2>
          <p>
            The Service is provided “as is” and “as available,” without
            warranties of any kind to the fullest extent permitted by law. We do
            not warrant that the Service will be uninterrupted, error-free, or
            that imported or estimated data will be accurate.
          </p>
          <p>
            To the fullest extent permitted by law, our total liability for any
            claim relating to the Service is limited to the amount you paid us
            for HomeRecipe in the twelve months before the claim. Nothing in
            these Terms limits liability that cannot be limited under applicable
            law, and some jurisdictions do not allow certain limitations, so
            parts of this section may not apply to you.
          </p>
        </section>

        <section className="legal-section" id="privacy">
          <h2>10. Privacy</h2>
          <p>
            Our <Link href="/privacy">Privacy Policy</Link> explains what we
            collect, how we use it, and which processors handle data on our
            behalf. It forms part of your agreement with us.
          </p>
        </section>

        <section className="legal-section" id="contact">
          <h2>11. Contact</h2>
          <p>
            Questions about these Terms:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
          <p>
            Service: HomeRecipe · Website:{" "}
            <a href="https://homerecipe.co">https://homerecipe.co</a> · Support:{" "}
            <Link href="/support">homerecipe.co/support</Link>
          </p>
        </section>

        <footer className="legal-footer">
          <span>© {new Date().getFullYear()} HomeRecipe</span>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/support">Support</Link>
          <Link href="/signin">Sign in</Link>
        </footer>
      </div>
    </main>
  );
}
