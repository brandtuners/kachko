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
    const handler = (event: MouseEvent) => {
      const element = (event.target as HTMLElement | null)?.closest(
        "[data-event]",
      ) as HTMLElement | null;
      const kind = element?.dataset.event;
      if (element && (kind === "LINK_CLICK" || kind === "SOCIAL_CLICK")) {
        const socialId = element.dataset.socialProfileId;
        trackClick(
          socialId ?? element.dataset.blockId,
          kind,
          socialId ? "social" : "block",
        );
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [trackClick]);

  return null;
}
