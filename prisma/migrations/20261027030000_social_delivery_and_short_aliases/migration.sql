ALTER TABLE "ShortLink" ADD COLUMN "utm" JSONB NOT NULL DEFAULT '{}';
CREATE TABLE "ShortLinkAlias" (
  "code" TEXT NOT NULL PRIMARY KEY,
  "shortLinkId" TEXT NOT NULL,
  CONSTRAINT "ShortLinkAlias_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ShortLinkAlias_shortLinkId_idx" ON "ShortLinkAlias"("shortLinkId");
INSERT INTO "ShortLinkAlias" ("code", "shortLinkId") SELECT "code", "id" FROM "ShortLink";
ALTER TABLE "DmDelivery" ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SocialCommentEvent" ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "DmDelivery_status_nextAttemptAt_createdAt_idx" ON "DmDelivery"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "SocialCommentEvent_status_nextAttemptAt_createdAt_idx" ON "SocialCommentEvent"("status", "nextAttemptAt", "createdAt");
