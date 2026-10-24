-- Preserve Kachko's stable UUIDs while linking each local account to Clerk.
ALTER TABLE "User" ADD COLUMN "clerkUserId" TEXT;

CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");
