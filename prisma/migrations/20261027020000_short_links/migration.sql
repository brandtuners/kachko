CREATE TABLE "ShortLink" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT,
  "channel" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "destinationUrl" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ShortLinkClick" (
  "id" TEXT NOT NULL,
  "shortLinkId" TEXT NOT NULL,
  "device" TEXT,
  "referrer" TEXT,
  "country" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShortLinkClick_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShortLink_code_key" ON "ShortLink"("code");
CREATE INDEX "ShortLink_userId_createdAt_idx" ON "ShortLink"("userId", "createdAt");
CREATE INDEX "ShortLinkClick_shortLinkId_createdAt_idx" ON "ShortLinkClick"("shortLinkId", "createdAt");
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortLinkClick" ADD CONSTRAINT "ShortLinkClick_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
