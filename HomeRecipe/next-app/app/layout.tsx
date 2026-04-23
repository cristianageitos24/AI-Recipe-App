import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import localFont from "next/font/local";
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
  title: "HomeRecipe",
  description: "Simple and tasty recipes. Search, save, and plan your meals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider signInUrl="/signin" signUpUrl="/signup" afterSignOutUrl="/">
      <html lang="en" className={creatoDisplay.variable}>
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
