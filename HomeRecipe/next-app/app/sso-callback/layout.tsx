import type { Metadata } from "next";
import { noIndexRobots } from "@/lib/site";

export const metadata: Metadata = {
  title: "Completing sign in",
  robots: noIndexRobots(),
};

export default function SSOCallbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
