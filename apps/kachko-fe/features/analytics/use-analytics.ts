"use client";

import { useCallback } from "react";
import { sendAnalyticsEvent } from "./client";

export function useAnalytics(pageId: string | undefined) {
  const trackView = useCallback(() => {
    if (pageId) sendAnalyticsEvent({ pageId, eventType: "PAGE_VIEW" });
  }, [pageId]);
  const trackClick = useCallback((targetId: string | undefined, kind: "LINK_CLICK" | "SOCIAL_CLICK", target: "block" | "social" = "block") => {
    if (!pageId || !targetId) return;
    sendAnalyticsEvent({ pageId, eventType: kind,
      ...(target === "social" ? { socialProfileId: targetId } : { blockId: targetId }) });
  }, [pageId]);
  return {
    trackView,
    trackClick,
  };
}
