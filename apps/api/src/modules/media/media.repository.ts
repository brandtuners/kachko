import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MediaRepository {
  constructor(private readonly db: PrismaService) {}
  byStorageKey(storageKey: string) { return this.db.media.findUnique({ where: { storageKey } }); }
  findOwned(userId: string, id: string) { return this.db.media.findFirst({ where: { id, userId } }); }
  public(id: string) { return this.db.media.findUnique({ where: { id } }); }
  list(userId: string) { return this.db.media.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }); }
  create(userId: string, data: { id: string; storageKey: string; url: string; mimeType: string; size: number; width: number; height: number }, forAvatar: boolean) {
    return this.db.$transaction(async tx => {
      const previous = forAvatar ? await tx.user.findUnique({ where: { id: userId }, select: {
        avatarMedia: { select: { id: true, storageKey: true } },
      } }) : null;
      const media = await tx.media.create({ data: { ...data, size: BigInt(data.size), userId } });
      let replacedStorageKey: string | null = null;
      if (forAvatar) {
        await tx.user.update({ where: { id: userId }, data: { avatarMediaId: media.id, avatarUrl: media.url } });
        await tx.page.updateMany({ where: { userId }, data: { revision: { increment: 1 } } });
        if (previous?.avatarMedia) {
          const blockUsage = await tx.pageBlock.count({ where: { mediaId: previous.avatarMedia.id } });
          if (!blockUsage) {
            await tx.media.delete({ where: { id: previous.avatarMedia.id, userId } });
            replacedStorageKey = previous.avatarMedia.storageKey;
          }
        }
      }
      return { media, replacedStorageKey };
    });
  }
  async usage(userId: string, id: string) {
    const [blocks, avatar, backgrounds] = await Promise.all([
      this.db.pageBlock.count({ where: { mediaId: id, page: { userId } } }),
      this.db.user.count({ where: { id: userId, avatarMediaId: id } }),
      this.db.page.count({ where: { userId, appearanceOverrides: { path: ['background', 'imageMediaId'], equals: id } } }),
    ]);
    return blocks + avatar + backgrounds;
  }
  delete(userId: string, id: string) { return this.db.media.delete({ where: { id, userId } }); }
  removeAvatar(userId: string) {
    return this.db.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: {
        avatarMedia: { select: { id: true, storageKey: true } },
      } });
      if (!user?.avatarMedia) return { storageKey: null };
      await tx.user.update({ where: { id: userId }, data: { avatarMediaId: null, avatarUrl: null } });
      await tx.page.updateMany({ where: { userId }, data: { revision: { increment: 1 } } });
      const blockUsage = await tx.pageBlock.count({ where: { mediaId: user.avatarMedia.id } });
      if (blockUsage) return { storageKey: null };
      await tx.media.delete({ where: { id: user.avatarMedia.id, userId } });
      return { storageKey: user.avatarMedia.storageKey };
    });
  }
}
