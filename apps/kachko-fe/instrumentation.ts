import * as Sentry from "@sentry/nextjs";

// Sentry client init (M9, §14 reliability: "Sentry captures a deliberate test
// exception"). Reads NEXT_PUBLIC_SENTRY_DSN; no-op when unset so local/dev builds
// never crash. Sets bright, on-brand tracesSampleRate and the V1 release tag.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function register() {
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: 0.1,
      release: "kachko-web@1.0.0",
    });
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: 0.1,
      release: "kachko-web@1.0.0",
    });
  }
}
