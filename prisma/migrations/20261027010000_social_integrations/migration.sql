CREATE TABLE "SocialAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'CONNECTED',
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncError" TEXT,
  "report" JSONB NOT NULL DEFAULT '{}',
  "syncLeaseUntil" TIMESTAMP(3),
  "nextSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SocialAccount_platform_externalId_key" ON "SocialAccount"("platform", "externalId");
CREATE INDEX "SocialAccount_userId_platform_idx" ON "SocialAccount"("userId", "platform");
CREATE INDEX "SocialAccount_status_nextSyncAt_idx" ON "SocialAccount"("status", "nextSyncAt");

CREATE TABLE "SocialSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "followers" INTEGER,
  "posts" INTEGER,
  "views" BIGINT,
  "reach" INTEGER,
  CONSTRAINT "SocialSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SocialSnapshot_accountId_date_key" ON "SocialSnapshot"("accountId", "date");

CREATE TABLE "SocialMedia" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "caption" TEXT,
  "permalink" TEXT,
  "mediaType" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "likes" INTEGER,
  "comments" INTEGER,
  "views" BIGINT,
  CONSTRAINT "SocialMedia_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SocialMedia_accountId_externalId_key" ON "SocialMedia"("accountId", "externalId");
CREATE INDEX "SocialMedia_accountId_publishedAt_idx" ON "SocialMedia"("accountId", "publishedAt");

CREATE TABLE "DmAutomation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "triggerType" TEXT NOT NULL,
  "mediaId" TEXT,
  "matchType" TEXT NOT NULL,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "message" TEXT NOT NULL,
  "buttonLabel" TEXT NOT NULL,
  "destinationUrl" TEXT NOT NULL,
  "publicReply" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "triggerStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DmAutomation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DmAutomation_accountId_isActive_idx" ON "DmAutomation"("accountId", "isActive");

CREATE TABLE "DmDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "commentCreatedAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "message" TEXT NOT NULL,
  "buttonLabel" TEXT NOT NULL,
  "destinationUrl" TEXT NOT NULL,
  "publicReply" TEXT,
  "clickToken" TEXT NOT NULL,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "providerMessageId" TEXT,
  "errorCode" TEXT,
  "sentAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DmDelivery_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DmDelivery_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "DmAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DmDelivery_clickToken_key" ON "DmDelivery"("clickToken");
CREATE UNIQUE INDEX "DmDelivery_accountId_commentId_key" ON "DmDelivery"("accountId", "commentId");
CREATE INDEX "DmDelivery_status_createdAt_idx" ON "DmDelivery"("status", "createdAt");
CREATE INDEX "DmDelivery_accountId_createdAt_idx" ON "DmDelivery"("accountId", "createdAt");

CREATE TABLE "SocialCommentEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "claimedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialCommentEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SocialCommentEvent_accountId_commentId_key" ON "SocialCommentEvent"("accountId", "commentId");
CREATE INDEX "SocialCommentEvent_status_createdAt_idx" ON "SocialCommentEvent"("status", "createdAt");
