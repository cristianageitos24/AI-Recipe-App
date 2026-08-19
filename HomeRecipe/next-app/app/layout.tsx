import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import localFont from "next/font/local";
import {
  publicRobots,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";
import "./globals.css";

const creatoDisplay = localFont({
  variable: "--font-creato-display",
  display: "swap",
  src: [
    {
      path: "./fonts/creato-display/CreatoDisplay-Thin.otf",
      weight: "100",
      style: "normal",
    },
    {
      path: "./fonts/creato-display/CreatoDisplay-ThinItalic.otf",
      weight: "100",
      style: "italic",
    },
    {
      path: "./fonts/creato-display/CreatoDisplay-Light.otf",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/creato-display/CreatoDisplay-LightItalic.otf",
      weight: "300",
      style: "italic",
    },
    {
      path: "./fonts/creato-display/CreatoDisplay-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/creato-display/CreatoDisplay-RegularItalic.otf",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/creato-display/CreatoDisplay-Medium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/creato-display/CreatoDisplay-MediumItalic.otf",
      weight: "500",
      style: "italic",
    },
    {
      path: "./fonts/creato-display/CreatoDisplay-Medium.otf",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/creato-display/CreatoDisplay-MediumItalic.otf",
      weight: "600",
      style: "italic",
    },
    {
      path: "./fonts/creato-display/CreatoDisplay-Bold.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/creato-display/CreatoDisplay-BoldItalic.otf",
      weight: "700",
      style: "italic",
    },
    {
      path: "./fonts/creato-display/CreatoDisplay-ExtraBold.otf",
      weight: "800",
      style: "normal",
    },
    {
      path: "./fonts/creato-display/CreatoDisplay-ExtraBoldItalic.otf",
      weight: "800",
      style: "italic",
    },
    {
      path: "./fonts/creato-display/CreatoDisplay-Black.otf",
      weight: "900",
      style: "normal",
    },
    {
      path: "./fonts/creato-display/CreatoDisplay-BlackItalic.otf",
      weight: "900",
      style: "italic",
    },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  robots: publicRobots(),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider signInUrl="/signin" signUpUrl="/signup" afterSignOutUrl="/">
      <html lang="en" className={creatoDisplay.variable}>
        <body className="antialiased">
          {children}
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
