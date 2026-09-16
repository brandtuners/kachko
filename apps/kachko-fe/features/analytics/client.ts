import type { AnalyticsEventType } from "@kachko/types";

export type AnalyticsEvent = {
  pageId: string;
  eventType: AnalyticsEventType;
  blockId?: string;
  socialProfileId?: string;
};

/** Fire-and-forget by design: telemetry must never delay or cancel navigation. */
export function sendAnalyticsEvent(event: AnalyticsEvent): void {
  const body = JSON.stringify(event);
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const accepted = navigator.sendBeacon(
        "/api/v1/analytics/events",
        new Blob([body], { type: "application/json" }),
      );
      if (accepted) return;
    }
  } catch {
    // Fall through to keepalive fetch when Beacon is unavailable or rejects.
  }
  if (typeof fetch !== "undefined") {
    void fetch("/api/v1/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body,
    }).catch(() => undefined);
  }
}
