import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { shortLinkDestination, type CreateShortLinkInput, type UpdateShortLinkInput } from '@kachko/validation';

export interface ShortClickMetadata { device: string; referrer: string | null; country: string | null }

@Injectable()
export class ShortLinksRepository {
  constructor(private readonly db: PrismaService) {}

  list(userId: string, cursor?: string) {
    return this.db.shortLink.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  }
  owned(userId: string, id: string) { return this.db.shortLink.findFirst({ where: { id, userId } }); }
  create(userId: string, code: string, data: CreateShortLinkInput) {
    return this.db.$transaction(async tx => {
      const link = await tx.shortLink.create({ data: { userId, code, title: data.title || null, destinationUrl: data.destinationUrl,
        utm: data.utm ?? {}, channel: data.channel || null, tags: [...new Set(data.tags ?? [])] } });
      await tx.shortLinkAlias.create({ data: { code, shortLinkId: link.id } });
      return link;
    });
  }
  async update(userId: string, id: string, data: UpdateShortLinkInput) {
    return this.db.$transaction(async tx => {
      if (data.code) {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ShortLink" WHERE "id" = ${id} AND "userId" = ${userId} FOR UPDATE`;
        if (!rows.length) return null;
        const alias = await tx.shortLinkAlias.findUnique({ where: { code: data.code } });
        if (alias && alias.shortLinkId !== id) throw { code: 'P2002' };
        if (!alias) await tx.shortLinkAlias.create({ data: { code: data.code, shortLinkId: id } });
      }
      const updated = await tx.shortLink.updateMany({ where: { id, userId }, data });
      return updated.count ? tx.shortLink.findUnique({ where: { id } }) : null;
    });
  }
  async resolve(code: string, metadata: ShortClickMetadata) {
    return this.db.$transaction(async tx => {
      const link = await tx.shortLink.findFirst({ where: { OR: [{ code }, { aliases: { some: { code } } }], isActive: true, user: { isActive: true, deletedAt: null } } });
      if (!link) return null;
      const updated = await tx.shortLink.updateMany({ where: { id: link.id, isActive: true,
        user: { isActive: true, deletedAt: null } }, data: { clickCount: { increment: 1 } } });
      if (!updated.count) return null;
      await tx.shortLinkClick.create({ data: { shortLinkId: link.id, ...metadata } });
      return shortLinkDestination(link.destinationUrl, link.utm as Record<string, string>);
    });
  }
  async stats(id: string, from: Date) {
    const where = { shortLinkId: id, createdAt: { gte: from } };
    const [clicks, devices, sources, countries, activity] = await Promise.all([
      this.db.shortLinkClick.count({ where }),
      this.db.shortLinkClick.groupBy({ by: ['device'], where, _count: { _all: true }, orderBy: { _count: { device: 'desc' } }, take: 10 }),
      this.db.shortLinkClick.groupBy({ by: ['referrer'], where, _count: { _all: true }, orderBy: { _count: { referrer: 'desc' } }, take: 10 }),
      this.db.shortLinkClick.groupBy({ by: ['country'], where, _count: { _all: true }, orderBy: { _count: { country: 'desc' } }, take: 20 }),
      this.db.$queryRaw<Array<{ date: string; clicks: number }>>`
        SELECT DATE("createdAt" AT TIME ZONE 'UTC')::text AS "date", COUNT(*)::int AS "clicks"
        FROM "ShortLinkClick" WHERE "shortLinkId" = ${id} AND "createdAt" >= ${from}
        GROUP BY 1 ORDER BY 1 ASC`,
    ]);
    return { clicks, activity, devices: devices.map(row => ({ label: row.device ?? 'unknown', clicks: row._count._all })),
      sources: sources.map(row => ({ label: row.referrer ?? 'Direct / unknown', clicks: row._count._all })),
      countries: countries.map(row => ({ label: row.country ?? 'Unknown', clicks: row._count._all })) };
  }
}
