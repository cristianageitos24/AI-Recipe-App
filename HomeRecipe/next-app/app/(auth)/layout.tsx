import type { Metadata } from "next";
import AuthCarousel from "@/components/AuthCarousel";
import { noIndexRobots } from "@/lib/site";
import "@/app/styling/LoginSignForm.css";

export const metadata: Metadata = {
  robots: noIndexRobots(),
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-page">
      <div className="auth-left">{children}</div>
      <div className="auth-right">
        <AuthCarousel />
      </div>
    </div>
  );
}
