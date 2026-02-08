import AuthCarousel from "@/components/AuthCarousel";
import "@/app/styling/LoginSignForm.css";

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
