ALTER TABLE "Page" ALTER COLUMN "isPublished" SET DEFAULT true;
ALTER TABLE "Page" ALTER COLUMN "publishedAt" SET DEFAULT CURRENT_TIMESTAMP;

UPDATE "Page"
SET "isPublished" = true,
    "publishedAt" = COALESCE("publishedAt", NOW())
WHERE "isPublished" = false;
