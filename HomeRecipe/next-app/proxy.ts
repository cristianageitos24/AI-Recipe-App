import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

const isAuthRoute = createRouteMatcher(["/signin(.*)", "/signup(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl?.pathname ?? "/";

  // redirect root to /signin before any auth protection runs
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  // If user is authenticated and on signin/signup, redirect to dashboard home
  if (isAuthRoute(req)) {
    const { userId } = await auth();
    if (userId) {
      return NextResponse.redirect(new URL("/dashboard/home", req.url));
    }
    return NextResponse.next();
  }

  if (isProtectedRoute(req)) await auth.protect();

  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return NextResponse.redirect(new URL("/dashboard/home", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
