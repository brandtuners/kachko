import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/dashboard", "/admin", "/onboarding"];

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const protectedRoute = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  );
  if (!protectedRoute) return;
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/login";
    signIn.search = "";
    signIn.searchParams.set("redirect_url", request.nextUrl.href);
    return NextResponse.redirect(signIn);
  }
}, {
  contentSecurityPolicy: {
    directives: {
      "font-src": ["'self'", "data:"],
      "img-src": ["data:", "blob:", "https:"],
      "connect-src": ["https://*.r2.cloudflarestorage.com"],
      "frame-src": ["https://www.youtube.com", "https://www.youtube-nocookie.com", "https://open.spotify.com"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "frame-ancestors": ["'none'"],
    },
  },
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
