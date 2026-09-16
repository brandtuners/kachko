"use client";

import { useEffect, useRef } from "react";
import { useAnalytics } from "../../../features/analytics/use-analytics";

// Client-only analytics harness for the public page (M7, §11.3). Fires a PAGE_VIEW
// beacon on mount and listens for clicks on instrumented blocks/socials. Works with
// the server-rendered public page — it never blocks SSR or navigation.
export function AnalyticsBeacon({ pageId }: { pageId: string }) {
  const { trackView, trackClick } = useAnalytics(pageId);
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackView();
  }, [trackView]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest("[data-event]") as HTMLElement | null;
      const kind = el?.dataset.event;
      if (kind === "LINK_CLICK" || kind === "SOCIAL_CLICK") {
        const socialId = el!.dataset.socialProfileId;
        trackClick(socialId ?? el!.dataset.blockId, kind, socialId ? "social" : "block");
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [trackClick]);

  return null;
}
