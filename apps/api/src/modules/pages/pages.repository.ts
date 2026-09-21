import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { blockContentSchemas, createBlockSchema, socialDataSchema, resolveAppearance, appearanceOverridesSchema, type UpdateAppearanceInput, type ApplyTemplateInput, type CreateSocialInput, type UpdateSocialInput, type CreatePageInput, type UpdatePageInput, type CreateBlockInput, type UpdateBlockInput, type ReorderBlocksInput } from '@kachko/validation';

export class PageResourceError extends Error {
  constructor(readonly code: 'PAGE_NOT_FOUND' | 'BLOCK_NOT_FOUND' | 'THEME_NOT_FOUND' | 'TEMPLATE_NOT_FOUND' | 'SOCIAL_NOT_FOUND' | 'MEDIA_NOT_FOUND') { super(code); }
}
export class PageInputError extends Error {
  constructor(readonly code: 'VALIDATION_ERROR' | 'PAGE_SLUG_UNAVAILABLE' | 'BLOCK_ORDER_CONFLICT' | 'SOCIAL_ORDER_CONFLICT' | 'TEMPLATE_REPLACE_REQUIRED', message: string) { super(message); }
}
const orderedBlocks = { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }], include: { media: true } };
const orderedSocials = { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] };
const fullPage = { blocks: orderedBlocks, theme: true, socials: orderedSocials, user: { select: { username: true } } };
export type StoredPage = Prisma.PageGetPayload<{ include: typeof fullPage }>;
export type StoredBlock = Prisma.PageBlockGetPayload<{ include: { media: true } }>;

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
      const existing = await tx.page.count({ where: { userId } });
      const { templateKey, slug: requestedSlug, ...fields } = data;
      const slug = existing === 0 ? user.username : requestedSlug;
      if (!slug) throw new PageInputError('VALIDATION_ERROR', 'A page slug is required for additional pages');
      const template = templateKey ? await tx.pageTemplate.findUnique({ where: { key: templateKey } }) : null;
      if (templateKey && !template) throw new PageResourceError('TEMPLATE_NOT_FOUND');
      const blocks = template ? this.templateBlocks(template.blocks) : [];
      return tx.page.create({ data: { ...fields, userId, slug, isPrimary: existing === 0,
        ...(template ? { themeKey: template.themeKey } : {}), blocks: { create: blocks } }, include: fullPage });
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
    return this.mutate(userId, id, async (tx, page) => {
      await tx.page.delete({ where: { id } });
      if (page.isPrimary) {
        const next = await tx.page.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
        if (next) await tx.page.update({ where: { id: next.id }, data: { isPrimary: true, revision: { increment: 1 } } });
      }
    });
  }
  publish(userId: string, id: string, published: boolean) {
    return this.mutate(userId, id, (tx, page) => tx.page.update({ where: { id }, data: {
      isPublished: published, publishedAt: published ? page.publishedAt ?? new Date() : null,
      revision: { increment: 1 },
    }, include: fullPage }));
  }
  addBlock(userId: string, id: string, data: CreateBlockInput) {
    return this.mutate(userId, id, async (tx, page) => {
      const position = page.blocks.length ? Math.max(...page.blocks.map(block => block.position)) + 1 : 0;
      const mediaId = data.type === 'IMAGE' ? data.content.mediaId : undefined;
      if (mediaId && !await tx.media.findFirst({ where: { id: mediaId, userId } })) throw new PageResourceError('MEDIA_NOT_FOUND');
      const block = await tx.pageBlock.create({ data: { pageId: id, type: data.type, position,
        content: data.content as Prisma.InputJsonObject, mediaId, isVisible: data.isVisible ?? true }, include: { media: true } });
      await tx.page.update({ where: { id }, data: { revision: { increment: 1 } } });
      return block;
    });
  }
  updateBlock(userId: string, id: string, blockId: string, data: UpdateBlockInput) {
    return this.mutate(userId, id, async (tx, page) => {
      const stored = page.blocks.find(block => block.id === blockId);
      if (!stored) throw new PageResourceError('BLOCK_NOT_FOUND');
      if (data.content !== undefined) {
        const parsed = blockContentSchemas[stored.type].safeParse(data.content);
        if (!parsed.success) throw new PageInputError('VALIDATION_ERROR', `Content must match the stored ${stored.type} block type`);
        data = { ...data, content: parsed.data };
      }
      const mediaId = stored.type === 'IMAGE' && data.content ? (data.content as { mediaId: string }).mediaId : undefined;
      if (mediaId && !await tx.media.findFirst({ where: { id: mediaId, userId } })) throw new PageResourceError('MEDIA_NOT_FOUND');
      const block = await tx.pageBlock.update({ where: { id: blockId }, data: {
        ...(data.content ? { content: data.content as Prisma.InputJsonObject } : {}),
        ...(mediaId ? { mediaId } : {}),
        ...(data.isVisible !== undefined ? { isVisible: data.isVisible } : {}),
      }, include: { media: true } });
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
  reorder(userId: string, id: string, input: ReorderBlocksInput) {
    return this.mutate(userId, id, async (tx, page) => {
      const currentIds = new Set(page.blocks.map(block => block.id));
      if (input.items.length !== currentIds.size || input.items.some(item => !currentIds.has(item.id))) {
        throw new PageInputError('BLOCK_ORDER_CONFLICT', 'Send every current block exactly once, including hidden blocks; reload the page and retry');
      }
      if (input.items.length) {
        const values = input.items.map(item => Prisma.sql`(${item.id}::text, ${item.position}::integer)`);
        await tx.$executeRaw`UPDATE "PageBlock" AS block
          SET "position" = ordering.position, "updatedAt" = NOW()
          FROM (VALUES ${Prisma.join(values)}) AS ordering(id, position)
          WHERE block."id" = ordering.id AND block."pageId" = ${id}`;
      }
      return tx.page.update({ where: { id }, data: { revision: { increment: 1 } }, include: fullPage });
    });
  }
  themes() { return this.db.theme.findMany({ where: { isSystem: true }, orderBy: { slug: 'asc' } }); }
  theme(key: string) { return this.db.theme.findUnique({ where: { slug: key } }); }
  templates() { return this.db.pageTemplate.findMany({ orderBy: { key: 'asc' } }); }
  template(key: string) { return this.db.pageTemplate.findUnique({ where: { key } }); }
  private templateBlocks(value: Prisma.JsonValue) {
    if (!Array.isArray(value)) throw new Error('Invalid stored template');
    return value.map((raw, position) => {
      const block = createBlockSchema.parse(raw);
      if (block.type !== 'LINK' && block.type !== 'TEXT') throw new Error('System templates may contain only LINK and TEXT blocks');
      return { type: block.type, content: block.content as Prisma.InputJsonObject, isVisible: block.isVisible, position };
    });
  }
  appearance(userId: string, id: string, input: UpdateAppearanceInput) {
    return this.mutate(userId, id, async (tx, page) => {
      const theme = input.themeKey ? await tx.theme.findUnique({ where: { slug: input.themeKey } }) : page.theme;
      if (!theme) throw new PageResourceError('THEME_NOT_FOUND');
      const overrides = appearanceOverridesSchema.parse(input.overrides ?? (input.themeKey ? {} : page.appearanceOverrides));
      const imageMediaId = overrides.background && 'imageMediaId' in overrides.background ? overrides.background.imageMediaId : undefined;
      if (imageMediaId && !await tx.media.findFirst({ where: { id: imageMediaId, userId } })) throw new PageResourceError('MEDIA_NOT_FOUND');
      resolveAppearance({ background: theme.background, typography: theme.typography, buttons: theme.buttons, cards: theme.cards }, overrides);
      return tx.page.update({ where: { id }, data: { themeKey: theme.slug,
        appearanceOverrides: overrides as Prisma.InputJsonObject, revision: { increment: 1 } }, include: fullPage });
    });
  }
  applyTemplate(userId: string, id: string, input: ApplyTemplateInput) {
    return this.mutate(userId, id, async (tx, page) => {
      const template = await tx.pageTemplate.findUnique({ where: { key: input.templateKey } });
      if (!template) throw new PageResourceError('TEMPLATE_NOT_FOUND');
      if (page.blocks.length && !input.replaceExistingBlocks) throw new PageInputError('TEMPLATE_REPLACE_REQUIRED', 'Confirm replaceExistingBlocks to replace existing page blocks');
      const blocks = this.templateBlocks(template.blocks);
      await tx.pageBlock.deleteMany({ where: { pageId: id } });
      await tx.pageBlock.createMany({ data: blocks.map(block => ({ ...block, pageId: id })) });
      return tx.page.update({ where: { id }, data: { themeKey: template.themeKey, appearanceOverrides: {}, revision: { increment: 1 } }, include: fullPage });
    });
  }
  addSocial(userId: string, id: string, input: CreateSocialInput) {
    return this.mutate(userId, id, async (tx, page) => {
      const position = page.socials.length ? Math.max(...page.socials.map(social => social.position)) + 1 : 0;
      const social = await tx.socialProfile.create({ data: { ...input, pageId: id, position, isVisible: input.isVisible ?? true } });
      await tx.page.update({ where: { id }, data: { revision: { increment: 1 } } });
      return social;
    });
  }
  updateSocial(userId: string, id: string, socialId: string, input: UpdateSocialInput) {
    return this.mutate(userId, id, async (tx, page) => {
      const stored = page.socials.find(social => social.id === socialId);
      if (!stored) throw new PageResourceError('SOCIAL_NOT_FOUND');
      const merged = socialDataSchema.safeParse({ platform: stored.platform, url: stored.url, username: stored.username, isVisible: stored.isVisible, ...input });
      if (!merged.success) throw new PageInputError('VALIDATION_ERROR', 'URL must match the selected social platform');
      const social = await tx.socialProfile.update({ where: { id: socialId }, data: merged.data });
      await tx.page.update({ where: { id }, data: { revision: { increment: 1 } } });
      return social;
    });
  }
  deleteSocial(userId: string, id: string, socialId: string) {
    return this.mutate(userId, id, async (tx, page) => {
      const stored = page.socials.find(social => social.id === socialId);
      if (!stored) throw new PageResourceError('SOCIAL_NOT_FOUND');
      await tx.socialProfile.delete({ where: { id: socialId } });
      await tx.socialProfile.updateMany({ where: { pageId: id, position: { gt: stored.position } }, data: { position: { decrement: 1 } } });
      await tx.page.update({ where: { id }, data: { revision: { increment: 1 } } });
    });
  }
  reorderSocials(userId: string, id: string, input: ReorderBlocksInput) {
    return this.mutate(userId, id, async (tx, page) => {
      const current = new Set(page.socials.map(social => social.id));
      if (input.items.length !== current.size || input.items.some(item => !current.has(item.id))) throw new PageInputError('SOCIAL_ORDER_CONFLICT', 'Send every current social profile exactly once, including hidden profiles');
      if (input.items.length) {
        const values = input.items.map(item => Prisma.sql`(${item.id}::text, ${item.position}::integer)`);
        await tx.$executeRaw`UPDATE "SocialProfile" AS social SET "position" = ordering.position, "updatedAt" = NOW()
          FROM (VALUES ${Prisma.join(values)}) AS ordering(id, position) WHERE social."id" = ordering.id AND social."pageId" = ${id}`;
      }
      return tx.page.update({ where: { id }, data: { revision: { increment: 1 } }, include: fullPage });
    });
  }
  private publicWhere(username: string, pageSlug?: string) {
    return { ...(pageSlug ? { slug: pageSlug, isPrimary: false } : { isPrimary: true }), isPublished: true,
      user: { username, isActive: true, deletedAt: null } };
  }
  publicGate(username: string, pageSlug?: string) {
    return this.db.page.findFirst({ where: this.publicWhere(username, pageSlug), select: { id: true, revision: true } });
  }
  publicSnapshot(username: string, pageSlug?: string) {
    return this.db.$transaction(tx => tx.page.findFirst({ where: this.publicWhere(username, pageSlug), include: {
      user: { select: { username: true, displayName: true, bio: true, avatarUrl: true } },
      blocks: { ...orderedBlocks, where: { isVisible: true } },
      theme: true, socials: { ...orderedSocials, where: { isVisible: true } },
    } }), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
