/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile our internal TS workspace packages so Next can import them directly
  // (AD-06: shared validation/types; packages/ui primitives).
  transpilePackages: ["@kachko/validation", "@kachko/types"],
  // Security headers (M9, §14 security): CSP, HSTS, frame-busting, MIME sniff guard.
  // In dev we relax upgrade-insecure-requests; prod Cloudflare enforces HSTS preload.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js streams the RSC payload + bootstrap as inline <script> tags, so the
              // app NEEDS inline scripts to hydrate (§14). Without script-src the policy falls
              // back to default-src 'self' and every inline script is blocked — the page renders
              // but never becomes interactive (clicks do a native form GET → "page restarts").
              // 'unsafe-eval' is required by React Refresh in dev. User content is still rendered
              // as text (never raw HTML) and img-src is locked down, so the XSS surface stays small.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Tailwind needs inline styles.
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              // Avatars/media from same-origin proxy + data/blob; R2 CDN would be added here.
              "img-src 'self' data: blob: https:",
              // Avatar and IMAGE uploads PUT bytes directly to a short-lived R2
              // presigned URL. Keep API traffic same-origin while allowing only
              // Cloudflare's R2 S3 endpoint as the external connection target.
              "connect-src 'self' https://*.r2.cloudflarestorage.com",
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://open.spotify.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  // Sentry (M9) — instruments client + server automatically when a DSN is set.
  // Keep it first so it can patch the runtime before other wrappers.
  ...(process.env.NEXT_PUBLIC_SENTRY_DSN
    ? await import("@sentry/nextjs").then((m) => ({ ...m.withSentryConfig({}) }))
    : {}),
  // Same-origin routing (AD-01): proxy /api/v1/* to the NestJS API in dev so the
  // web app calls relative URLs just like in production (Appendix A).
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://localhost:4000/api/v1/:path*",
      },
      // AD-08: public profiles live at /@username. Serve from /u/[username].
      {
        source: "/@:username",
        destination: "/u/:username",
      },
    ];
  },
};

export default nextConfig;
