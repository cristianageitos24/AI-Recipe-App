import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Work_Sans } from "next/font/google";
import { NavigationLoadingOverlay } from "@/components/NavigationLoadingOverlay";
import "./globals.css";

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
    <ClerkProvider signInUrl="/signin" signUpUrl="/signup" afterSignOutUrl="/">
      <html lang="en">
        <body
          className={`${workSans.variable} font-sans antialiased`}
        >
          {children}
          <NavigationLoadingOverlay />
        </body>
      </html>
    </ClerkProvider>
  );
}
