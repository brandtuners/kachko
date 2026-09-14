CREATE TYPE "BlockType" AS ENUM ('LINK');

CREATE TABLE "Page" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "themeKey" TEXT NOT NULL DEFAULT 'minimal',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Page_userId_key" ON "Page"("userId");
CREATE UNIQUE INDEX "Page_slug_key" ON "Page"("slug");
ALTER TABLE "Page" ADD CONSTRAINT "Page_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PageBlock" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "type" "BlockType" NOT NULL,
  "position" INTEGER NOT NULL,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "content" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PageBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PageBlock_position_nonnegative" CHECK ("position" >= 0)
);
CREATE INDEX "PageBlock_pageId_position_idx" ON "PageBlock"("pageId", "position");
CREATE INDEX "PageBlock_pageId_isVisible_position_idx" ON "PageBlock"("pageId", "isVisible", "position");
ALTER TABLE "PageBlock" ADD CONSTRAINT "PageBlock_pageId_fkey" FOREIGN KEY ("pageId")
  REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
