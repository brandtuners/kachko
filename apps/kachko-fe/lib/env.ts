// Server-side env for the web app (§16). Only NEXT_PUBLIC_* is exposed to the
// browser; this helper reads it with sensible M0 defaults.
export const webEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  cdnUrl: process.env.NEXT_PUBLIC_CDN_URL ?? "",
  sentryDsn: process.env.SENTRY_DSN,
} as const;
