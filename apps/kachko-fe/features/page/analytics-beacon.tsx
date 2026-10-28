"use client";

import { useEffect, useRef } from "react";
import { useAnalytics } from "../analytics/use-analytics";

// Client-only analytics harness for the public page. It never blocks SSR or
// navigation: views use Beacon and instrumented clicks use the same fallback.
export function AnalyticsBeacon({ pageId }: { pageId: string }) {
  const { trackView, trackClick } = useAnalytics(pageId);
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackView();
  }, [trackView]);

  useEffect(() => {
    const routeSource = (event: Event) => {
      const anchor = (event.target as HTMLElement | null)?.closest('a[data-event="LINK_CLICK"]') as HTMLAnchorElement | null;
      if (!anchor || !document.referrer) return;
      const url = new URL(anchor.href);
      if (url.origin === window.location.origin && url.pathname.startsWith('/api/v1/public/routes/')) {
        url.searchParams.set('source', new URL(document.referrer).origin);
        anchor.href = url.href;
      }
    };
    const handler = (event: MouseEvent) => {
      routeSource(event);
      const element = (event.target as HTMLElement | null)?.closest(
        "[data-event]",
      ) as HTMLElement | null;
      const kind = element?.dataset.event;
      if (element && (kind === "LINK_CLICK" || kind === "SOCIAL_CLICK" || kind === "WHATSAPP_CLICK")) {
        const socialId = element.dataset.socialProfileId;
        trackClick(
          socialId ?? element.dataset.blockId,
          kind,
          socialId ? "social" : "block",
        );
      }
    };
    document.addEventListener("pointerdown", routeSource, true);
    document.addEventListener("click", handler, true);
    return () => {
      document.removeEventListener("pointerdown", routeSource, true);
      document.removeEventListener("click", handler, true);
    };
  }, [trackClick]);

  return null;
}
