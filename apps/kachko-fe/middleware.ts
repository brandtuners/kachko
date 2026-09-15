import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Middleware placeholder (§8.1 auth gating on /dashboard, /admin, /onboarding/*).
// Real auth-gating logic arrives with M1 (sessions, cookies).
export function middleware(request: NextRequest) {
  // M1 will inspect the kachko_session cookie and redirect unauthenticated
  // users from protected routes to /login.
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/onboarding/:path*"],
};
