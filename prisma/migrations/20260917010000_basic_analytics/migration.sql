CREATE TYPE "AnalyticsEventType" AS ENUM ('PAGE_VIEW', 'LINK_CLICK', 'SOCIAL_CLICK');

CREATE TABLE "AnalyticsEvent" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "blockId" TEXT,
  "socialProfileId" TEXT,
  "eventType" "AnalyticsEventType" NOT NULL,
  "ipHash" TEXT,
  "country" TEXT,
  "city" TEXT,
  "device" TEXT,
  "browser" TEXT,
  "os" TEXT,
  "referrer" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsEvent_pageId_createdAt_idx" ON "AnalyticsEvent"("pageId", "createdAt");
CREATE INDEX "AnalyticsEvent_pageId_eventType_createdAt_idx" ON "AnalyticsEvent"("pageId", "eventType", "createdAt");
CREATE INDEX "AnalyticsEvent_eventType_createdAt_idx" ON "AnalyticsEvent"("eventType", "createdAt");
CREATE INDEX "AnalyticsEvent_socialProfileId_idx" ON "AnalyticsEvent"("socialProfileId");
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "PageBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_socialProfileId_fkey" FOREIGN KEY ("socialProfileId") REFERENCES "SocialProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
