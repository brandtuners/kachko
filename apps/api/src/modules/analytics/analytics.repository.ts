import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { AnalyticsEventType } from '../../generated/prisma/client';

export interface StoredAnalyticsMetadata {
  ipHash: string | null;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
}
export interface AnalyticsTarget { blockId?: string; socialProfileId?: string }

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly db: PrismaService) {}

  async target(pageId: string, blockId: string | undefined, socialProfileId: string | undefined, eventType: AnalyticsEventType): Promise<AnalyticsTarget | null> {
    const page = await this.db.page.findFirst({
      where: { id: pageId, isPublished: true, user: { isActive: true, deletedAt: null } },
      select: { id: true },
    });
    if (!page) return null;
    if (eventType === 'PAGE_VIEW') return {};
    if (socialProfileId) {
      const social = await this.db.socialProfile.findFirst({ where: { id: socialProfileId, pageId, isVisible: true }, select: { id: true } });
      return social ? { socialProfileId: social.id } : null;
    }
    const type = eventType === 'LINK_CLICK' ? 'LINK' as const : 'SOCIAL' as const;
    const block = await this.db.pageBlock.findFirst({ where: { id: blockId, pageId, type, isVisible: true }, select: { id: true } });
    return block ? { blockId: block.id } : null;
  }

  create(pageId: string, target: AnalyticsTarget, eventType: AnalyticsEventType, metadata: StoredAnalyticsMetadata) {
    return this.db.analyticsEvent.create({ data: { pageId, ...target, eventType, ...metadata }, select: { id: true } });
  }

  async ownedPage(userId: string, pageId: string) {
    return Boolean(await this.db.page.findFirst({ where: { id: pageId, userId }, select: { id: true } }));
  }

  counts(pageId: string, from: Date, to: Date) {
    return this.db.analyticsEvent.groupBy({
      by: ['eventType'], where: { pageId, createdAt: { gte: from, lte: to } }, _count: { _all: true },
    });
  }

  async uniqueVisitors(pageId: string, from: Date, to: Date) {
    const rows = await this.db.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT "ipHash")::int AS "count"
      FROM "AnalyticsEvent"
      WHERE "pageId" = ${pageId} AND "eventType" = 'PAGE_VIEW'::"AnalyticsEventType"
        AND "createdAt" >= ${from} AND "createdAt" <= ${to}`;
    return rows[0]?.count ?? 0;
  }

  timeseries(pageId: string, from: Date, to: Date) {
    return this.db.$queryRaw<{ date: string; eventType: AnalyticsEventType; count: number }[]>`
      SELECT DATE("createdAt" AT TIME ZONE 'UTC')::text AS "date", "eventType", COUNT(*)::int AS "count"
      FROM "AnalyticsEvent"
      WHERE "pageId" = ${pageId} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY 1, 2 ORDER BY 1 ASC`;
  }

  topLinks(pageId: string, from: Date, to: Date) {
    return this.db.$queryRaw<{ blockId: string; title: string; clicks: number }[]>`
      SELECT e."blockId", COALESCE(b."content"->>'title', 'Untitled link') AS "title", COUNT(*)::int AS "clicks"
      FROM "AnalyticsEvent" e
      JOIN "PageBlock" b ON b."id" = e."blockId" AND b."pageId" = e."pageId"
      WHERE e."pageId" = ${pageId} AND e."eventType" = 'LINK_CLICK'::"AnalyticsEventType"
        AND e."createdAt" >= ${from} AND e."createdAt" <= ${to}
      GROUP BY e."blockId", b."content"->>'title'
      ORDER BY "clicks" DESC, e."blockId" ASC LIMIT 10`;
  }

  topSocials(pageId: string, from: Date, to: Date) {
    return this.db.$queryRaw<{ targetId: string; platform: string; label: string; clicks: number }[]>`
      WITH social_clicks AS (
        SELECT e."socialProfileId" AS "targetId", s."platform"::text AS "platform",
          COALESCE(NULLIF(s."username", ''), s."url") AS "label", COUNT(*)::int AS "clicks"
        FROM "AnalyticsEvent" e
        JOIN "SocialProfile" s ON s."id" = e."socialProfileId" AND s."pageId" = e."pageId"
        WHERE e."pageId" = ${pageId} AND e."eventType" = 'SOCIAL_CLICK'::"AnalyticsEventType"
          AND e."socialProfileId" IS NOT NULL AND e."createdAt" >= ${from} AND e."createdAt" <= ${to}
        GROUP BY e."socialProfileId", s."platform", s."username", s."url"
        UNION ALL
        SELECT e."blockId" AS "targetId", COALESCE(b."content"->>'platform', 'SOCIAL') AS "platform",
          COALESCE(NULLIF(b."content"->>'username', ''), 'Social link') AS "label", COUNT(*)::int AS "clicks"
        FROM "AnalyticsEvent" e
        JOIN "PageBlock" b ON b."id" = e."blockId" AND b."pageId" = e."pageId" AND b."type" = 'SOCIAL'::"BlockType"
        WHERE e."pageId" = ${pageId} AND e."eventType" = 'SOCIAL_CLICK'::"AnalyticsEventType"
          AND e."blockId" IS NOT NULL AND e."createdAt" >= ${from} AND e."createdAt" <= ${to}
        GROUP BY e."blockId", b."content"->>'platform', b."content"->>'username'
      )
      SELECT "targetId", "platform", "label", "clicks" FROM social_clicks
      ORDER BY "clicks" DESC, "targetId" ASC LIMIT 10`;
  }

  referrers(pageId: string, from: Date, to: Date) {
    return this.db.$queryRaw<{ referrer: string; visits: number }[]>`
      SELECT "referrer", COUNT(*)::int AS "visits"
      FROM "AnalyticsEvent"
      WHERE "pageId" = ${pageId} AND "eventType" = 'PAGE_VIEW'::"AnalyticsEventType"
        AND "referrer" IS NOT NULL AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY "referrer" ORDER BY "visits" DESC, "referrer" ASC LIMIT 10`;
  }

  geo(pageId: string, from: Date, to: Date) {
    return this.db.$queryRaw<{ country: string; city: string | null; visits: number }[]>`
      SELECT COALESCE("country", 'Unknown') AS "country", "city", COUNT(*)::int AS "visits"
      FROM "AnalyticsEvent"
      WHERE "pageId" = ${pageId} AND "eventType" = 'PAGE_VIEW'::"AnalyticsEventType"
        AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY "country", "city" ORDER BY "visits" DESC, "country" ASC, "city" ASC NULLS LAST LIMIT 50`;
  }

  devices(pageId: string, from: Date, to: Date) {
    return this.db.$queryRaw<{ device: string; visits: number }[]>`
      SELECT COALESCE("device", 'unknown') AS "device", COUNT(*)::int AS "visits"
      FROM "AnalyticsEvent"
      WHERE "pageId" = ${pageId} AND "eventType" = 'PAGE_VIEW'::"AnalyticsEventType"
        AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY "device" ORDER BY "visits" DESC, "device" ASC`;
  }
}
