import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import { Work_Sans } from "next/font/google";
import { NavigationLoadingOverlay } from "@/components/NavigationLoadingOverlay";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
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
    <ClerkProvider signInUrl="/" signUpUrl="/signup" afterSignOutUrl="/">
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${workSans.variable} antialiased`}
        >
          {children}
          <NavigationLoadingOverlay />
        </body>
      </html>
    </ClerkProvider>
  );
}
