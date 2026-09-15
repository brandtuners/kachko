"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Error boundary wrapper (M9). Catches client render errors, reports to Sentry (when
// configured), and shows a bright, recoverable fallback with a retry action (§14
// product: "Error states have retry actions").
export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Surface the built-in Next.js error overlay in dev; in prod Sentry captures it.
    const handler = (e: ErrorEvent) => {
      if (process.env.NEXT_PUBLIC_SENTRY_DSN) Sentry.captureException(e.error ?? e.message);
    };
    window.addEventListener("error", handler);
    return () => window.removeEventListener("error", handler);
  }, []);

  return <>{children}</>;
}

// Full-page error fallback (used by app/error.tsx). Has a retry that reloads.
// Cream + lime scheme (app-wide design v2).
export function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="ob-shell relative flex min-h-dvh flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[340px] bg-[radial-gradient(620px_300px_at_50%_0%,rgba(200,242,74,0.28),transparent_70%)]" />
      <svg viewBox="0 0 48 48" className="h-10 w-10 opacity-80" aria-hidden>
        <path d="M8 40V18c0-8.3 6.7-15 15-15s15 6.7 15 15v22h-7V18c0-4.4-3.6-8-8-8s-8 3.6-8 8v22H8Z" fill="#111312" />
        <path d="M29 40V18c0-4.4 3.6-8 8-8v30h-8Z" fill="#c8f24a" />
      </svg>
      <h1 className="text-3xl font-extrabold tracking-[-1px] text-[var(--k-ink)]">Something broke</h1>
      <p className="max-w-sm text-[var(--k-muted)]">
        That wasn&apos;t supposed to happen. We&apos;ve been notified. Try again — your data is safe.
      </p>
      {process.env.NEXT_PUBLIC_SENTRY_DSN ? (
        <button
          onClick={() => {
            Sentry.captureException(error);
            reset();
          }}
          className="btn-primary"
        >
          Try again
        </button>
      ) : (
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
      )}
    </main>
  );
}
