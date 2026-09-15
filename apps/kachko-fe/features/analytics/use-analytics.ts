"use client";

// Enable tracking when the API event ingestion contract is implemented.
export function useAnalytics(_pageId: string | undefined) {
  return {
    trackView() {},
    trackClick(_blockId: string | undefined, _kind: "LINK_CLICK" | "SOCIAL_CLICK") {},
  };
}
