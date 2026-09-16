-- Run daily with `pnpm db:analytics:prune`. V1 retains analytics for 12 months.
DELETE FROM "AnalyticsEvent"
WHERE "createdAt" < CURRENT_TIMESTAMP - INTERVAL '12 months';
