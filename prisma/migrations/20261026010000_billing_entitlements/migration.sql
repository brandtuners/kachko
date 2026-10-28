ALTER TABLE "User"
  ADD COLUMN "billingPlan" TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN "billingFeatures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "billingUpdatedAt" TIMESTAMP(3);
