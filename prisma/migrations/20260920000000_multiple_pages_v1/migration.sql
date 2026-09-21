ALTER TABLE "Page" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- Every existing owner has at most one page before this migration, so each
-- existing page safely becomes that owner's primary page.
UPDATE "Page" SET "isPrimary" = true;

DROP INDEX "Page_userId_key";
DROP INDEX "Page_slug_key";

CREATE UNIQUE INDEX "Page_userId_slug_key" ON "Page"("userId", "slug");
CREATE UNIQUE INDEX "Page_one_primary_per_user" ON "Page"("userId") WHERE "isPrimary" = true;
CREATE INDEX "Page_userId_createdAt_idx" ON "Page"("userId", "createdAt");
CREATE INDEX "Page_userId_isPrimary_idx" ON "Page"("userId", "isPrimary");
CREATE INDEX "Page_isPublished_idx" ON "Page"("isPublished");
