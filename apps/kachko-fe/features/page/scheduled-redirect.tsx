"use client";

import { useEffect } from "react";

export function ScheduledRedirect({ blockId }: { blockId: string }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(`/api/v1/public/routes/${encodeURIComponent(blockId)}`, window.location.origin);
      if (document.referrer) url.searchParams.set('source', new URL(document.referrer).origin);
      window.location.replace(url.href);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [blockId]);
  return <p role="status" className="sr-only">Redirecting to the featured link…</p>;
}
