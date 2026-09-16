CREATE TABLE "Media" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" BIGINT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Media_size_positive" CHECK ("size" > 0 AND "size" <= 5242880),
  CONSTRAINT "Media_dimensions_bounded" CHECK ("width" > 0 AND "height" > 0 AND "width" <= 4096 AND "height" <= 4096)
);
CREATE UNIQUE INDEX "Media_storageKey_key" ON "Media"("storageKey");
CREATE INDEX "Media_userId_createdAt_idx" ON "Media"("userId", "createdAt");

ALTER TABLE "User" ADD COLUMN "avatarMediaId" TEXT;
CREATE UNIQUE INDEX "User_avatarMediaId_key" ON "User"("avatarMediaId");
ALTER TABLE "User" ADD CONSTRAINT "User_avatarMediaId_fkey" FOREIGN KEY ("avatarMediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PageBlock" ADD COLUMN "mediaId" TEXT;
CREATE INDEX "PageBlock_mediaId_idx" ON "PageBlock"("mediaId");
ALTER TABLE "PageBlock" ADD CONSTRAINT "PageBlock_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
