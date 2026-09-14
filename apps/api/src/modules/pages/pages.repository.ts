import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { CreatePageInput, UpdatePageInput, CreateLinkBlockInput, UpdateLinkBlockInput } from '@kachko/validation';

export class PageResourceError extends Error {
  constructor(readonly code: 'PAGE_NOT_FOUND' | 'BLOCK_NOT_FOUND') { super(code); }
}
const orderedBlocks = { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] };
const fullPage = { blocks: orderedBlocks };
export type StoredPage = Prisma.PageGetPayload<{ include: typeof fullPage }>;
export type StoredBlock = Prisma.PageBlockGetPayload<object>;

@Injectable()
export class PagesRepository {
  constructor(private readonly db: PrismaService) {}
  private async lockOwner(tx: Prisma.TransactionClient, userId: string) {
    // All page mutations and username edits lock User before Page, preventing
    // create/rename races and serializing block positions without deadlocks.
    const users = await tx.$queryRaw<{ id: string; username: string }[]>`
      SELECT "id", "username" FROM "User" WHERE "id" = ${userId}
      AND "isActive" = true AND "deletedAt" IS NULL FOR UPDATE`;
    if (!users[0]) throw new PageResourceError('PAGE_NOT_FOUND');
    return users[0];
  }
  list(userId: string) { return this.db.page.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }); }
  get(userId: string, id: string) {
    return this.db.$transaction(tx => tx.page.findFirst({ where: { id, userId }, include: fullPage }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  create(userId: string, data: CreatePageInput) {
    return this.db.$transaction(async tx => {
      const user = await this.lockOwner(tx, userId);
      return tx.page.create({ data: { ...data, userId, slug: user.username }, include: fullPage });
    });
  }
  private mutate<T>(userId: string, id: string, action: (tx: Prisma.TransactionClient, page: StoredPage) => Promise<T>) {
    return this.db.$transaction(async tx => {
      await this.lockOwner(tx, userId);
      const page = await tx.page.findFirst({ where: { id, userId }, include: fullPage });
      if (!page) throw new PageResourceError('PAGE_NOT_FOUND');
      return action(tx, page);
    });
  }
  update(userId: string, id: string, data: UpdatePageInput) {
    return this.mutate(userId, id, tx => tx.page.update({ where: { id }, data: { ...data, revision: { increment: 1 } }, include: fullPage }));
  }
  delete(userId: string, id: string) {
    return this.mutate(userId, id, async tx => { await tx.page.delete({ where: { id } }); });
  }
  publish(userId: string, id: string, published: boolean) {
    return this.mutate(userId, id, (tx, page) => tx.page.update({ where: { id }, data: {
      isPublished: published, publishedAt: published ? page.publishedAt ?? new Date() : null,
      revision: { increment: 1 },
    }, include: fullPage }));
  }
  addBlock(userId: string, id: string, data: CreateLinkBlockInput) {
    return this.mutate(userId, id, async (tx, page) => {
      const position = page.blocks.length ? Math.max(...page.blocks.map(block => block.position)) + 1 : 0;
      const block = await tx.pageBlock.create({ data: { pageId: id, type: 'LINK', position,
        content: data.content as Prisma.InputJsonObject, isVisible: data.isVisible ?? true } });
      await tx.page.update({ where: { id }, data: { revision: { increment: 1 } } });
      return block;
    });
  }
  updateBlock(userId: string, id: string, blockId: string, data: UpdateLinkBlockInput) {
    return this.mutate(userId, id, async (tx, page) => {
      if (!page.blocks.some(block => block.id === blockId)) throw new PageResourceError('BLOCK_NOT_FOUND');
      const block = await tx.pageBlock.update({ where: { id: blockId }, data: {
        ...(data.content ? { content: data.content as Prisma.InputJsonObject } : {}),
        ...(data.isVisible !== undefined ? { isVisible: data.isVisible } : {}),
      } });
      await tx.page.update({ where: { id }, data: { revision: { increment: 1 } } });
      return block;
    });
  }
  deleteBlock(userId: string, id: string, blockId: string) {
    return this.mutate(userId, id, async (tx, page) => {
      const block = page.blocks.find(item => item.id === blockId);
      if (!block) throw new PageResourceError('BLOCK_NOT_FOUND');
      await tx.pageBlock.delete({ where: { id: blockId } });
      await tx.pageBlock.updateMany({ where: { pageId: id, position: { gt: block.position } }, data: { position: { decrement: 1 } } });
      await tx.page.update({ where: { id }, data: { revision: { increment: 1 } } });
    });
  }
  private publicWhere(slug: string) {
    return { slug, isPublished: true, user: { username: slug, isActive: true, deletedAt: null } };
  }
  publicGate(slug: string) {
    return this.db.page.findFirst({ where: this.publicWhere(slug), select: { id: true, revision: true } });
  }
  publicSnapshot(slug: string) {
    return this.db.$transaction(tx => tx.page.findFirst({ where: this.publicWhere(slug), include: {
      user: { select: { username: true, displayName: true, bio: true, avatarUrl: true } },
      blocks: { ...orderedBlocks, where: { isVisible: true } },
    } }), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
