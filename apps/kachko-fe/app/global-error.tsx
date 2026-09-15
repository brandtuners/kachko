"use client";

import { ErrorFallback } from "./error-boundary";

// Global error boundary (M9, §14). Catches errors in the root layout segment and
// provides a bright, recoverable fallback with a retry action.
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <ErrorFallback error={error} reset={reset} />
      </body>
    </html>
  );
}
