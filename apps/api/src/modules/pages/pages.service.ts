import { Injectable } from '@nestjs/common';
import { linkContentSchema, publicPageSchema, type CreatePageInput, type UpdatePageInput,
  type CreateLinkBlockInput, type UpdateLinkBlockInput } from '@kachko/validation';
import type { OwnerPage, PageSummary, LinkBlock, PublicPage } from '@kachko/types';
import { PagesRepository, PageResourceError, type StoredBlock, type StoredPage } from './pages.repository';
import { PublicPageCache } from './public-page.cache';
import { identityError } from '../identity/identity.service';

function summary(page: Omit<StoredPage, 'blocks'>): PageSummary {
  if (page.themeKey !== 'minimal') throw new Error('Unsupported persisted page theme');
  return { id: page.id, slug: page.slug, title: page.title, description: page.description, themeKey: page.themeKey,
    isPublished: page.isPublished, publishedAt: page.publishedAt?.toISOString() ?? null,
    createdAt: page.createdAt.toISOString(), updatedAt: page.updatedAt.toISOString() };
}
function blockDto(block: StoredBlock): LinkBlock {
  return { id: block.id, type: block.type, position: block.position, isVisible: block.isVisible,
    content: linkContentSchema.parse(block.content), createdAt: block.createdAt.toISOString(), updatedAt: block.updatedAt.toISOString() };
}
function ownerDto(page: StoredPage): OwnerPage { return { ...summary(page), blocks: page.blocks.map(blockDto) }; }

@Injectable()
export class PagesService {
  constructor(private readonly repository: PagesRepository, private readonly cache: PublicPageCache) {}
  private async execute<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); }
    catch (error) {
      if (error instanceof PageResourceError) identityError(404, error.code, error.code === 'PAGE_NOT_FOUND' ? 'Page not found' : 'Block not found');
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        identityError(409, 'PAGE_ALREADY_EXISTS', 'An account can have only one page');
      }
      throw error;
    }
  }
  async list(userId: string) { return { data: (await this.repository.list(userId)).map(summary) }; }
  async get(userId: string, id: string) {
    const page = await this.repository.get(userId, id);
    if (!page) identityError(404, 'PAGE_NOT_FOUND', 'Page not found');
    return { data: ownerDto(page) };
  }
  create(userId: string, input: CreatePageInput) { return this.execute(async () => ({ data: ownerDto(await this.repository.create(userId, input)) })); }
  update(userId: string, id: string, input: UpdatePageInput) { return this.execute(async () => ({ data: ownerDto(await this.repository.update(userId, id, input)) })); }
  delete(userId: string, id: string) { return this.execute(async () => { await this.repository.delete(userId, id); return { data: { deleted: true } }; }); }
  publish(userId: string, id: string, published: boolean) { return this.execute(async () => ({ data: ownerDto(await this.repository.publish(userId, id, published)) })); }
  addBlock(userId: string, id: string, input: CreateLinkBlockInput) { return this.execute(async () => ({ data: blockDto(await this.repository.addBlock(userId, id, input)) })); }
  updateBlock(userId: string, id: string, blockId: string, input: UpdateLinkBlockInput) { return this.execute(async () => ({ data: blockDto(await this.repository.updateBlock(userId, id, blockId, input)) })); }
  deleteBlock(userId: string, id: string, blockId: string) { return this.execute(async () => { await this.repository.deleteBlock(userId, id, blockId); return { data: { deleted: true } }; }); }
  async publicPage(username: string) {
    // Never authorize public visibility from cache. Checking PostgreSQL first also
    // handles suspension/deletion and old usernames while Redis is unavailable.
    const gate = await this.repository.publicGate(username);
    if (!gate) identityError(404, 'PAGE_NOT_FOUND', 'Page not found');
    const hit = await this.cache.get(this.cache.key(username, gate));
    if (hit) return { data: hit };
    const page = await this.repository.publicSnapshot(username);
    if (!page) identityError(404, 'PAGE_NOT_FOUND', 'Page not found');
    const result: PublicPage = publicPageSchema.parse({
      profile: page.user, page: { title: page.title, description: page.description, themeKey: page.themeKey },
      blocks: page.blocks.map(block => ({ id: block.id, type: block.type, content: linkContentSchema.parse(block.content) })),
    });
    // Old in-flight readers can populate only their old revision, not the new one.
    await this.cache.set(this.cache.key(username, page), result);
    return { data: result };
  }
}
