import type { Page, Theme, SocialProfile as StoredSocial, PageTemplate as StoredTemplate } from '../../generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import QRCode from 'qrcode';
import { resolveAppearance, appearanceOverridesSchema, themeKeySchema, templateKeySchema, createBlockSchema, publicSocialSchema, type UpdateAppearanceInput, type ApplyTemplateInput, type CreateSocialInput, type UpdateSocialInput,  publicPageSchema, publicBlockSchema, type CreatePageInput, type UpdatePageInput,
  type CreateBlockInput, type UpdateBlockInput, type ReorderBlocksInput } from '@kachko/validation';
import type { OwnerPage, PageSummary, PageBlock, PublicPage, SocialProfile, SystemTheme, PageTemplate } from '@kachko/types';
import { PagesRepository, PageResourceError, PageInputError, type StoredBlock, type StoredPage } from './pages.repository';
import { PublicPageCache } from './public-page.cache';
import { identityError } from '../identity/identity.service';

function summary(page: Page): PageSummary {
  return { id: page.id, slug: page.slug, isPrimary: page.isPrimary, title: page.title, description: page.description, themeKey: themeKeySchema.parse(page.themeKey),
    isPublished: page.isPublished, publishedAt: page.publishedAt?.toISOString() ?? null,
    createdAt: page.createdAt.toISOString(), updatedAt: page.updatedAt.toISOString() };
}
function blockDto(block: StoredBlock): PageBlock {
  const common = { id: block.id, position: block.position, isVisible: block.isVisible,
    createdAt: block.createdAt.toISOString(), updatedAt: block.updatedAt.toISOString() };
  const content = block.type === 'IMAGE'
    ? { ...(block.content as Record<string, unknown>), url: block.media?.url }
    : block.content;
  return { ...common, ...publicBlockSchema.parse({ id: block.id, type: block.type, content }) };
}
function themeConfig(theme: Theme) { return { background: theme.background, typography: theme.typography, buttons: theme.buttons, cards: theme.cards }; }
function socialDto(social: StoredSocial): SocialProfile {
  return { ...publicSocialSchema.parse({ id: social.id, platform: social.platform, username: social.username, url: social.url }),
    position: social.position, isVisible: social.isVisible, createdAt: social.createdAt.toISOString(), updatedAt: social.updatedAt.toISOString() };
}
function ownerDto(page: StoredPage): OwnerPage { return { ...summary(page), blocks: page.blocks.map(blockDto),
  appearance: resolveAppearance(themeConfig(page.theme), page.appearanceOverrides),
  appearanceOverrides: appearanceOverridesSchema.parse(page.appearanceOverrides), socials: page.socials.map(socialDto) }; }
function themeDto(theme: Theme): SystemTheme {
  return { id: theme.id, key: themeKeySchema.parse(theme.slug), name: theme.name, config: resolveAppearance(themeConfig(theme), {}) };
}
function templateDto(template: StoredTemplate): PageTemplate {
  if (!Array.isArray(template.blocks)) throw new Error('Invalid stored template');
  const blocks = template.blocks.map(value => createBlockSchema.parse(value));
  if (blocks.some(block => block.type !== 'LINK' && block.type !== 'TEXT')) throw new Error('System templates may contain only LINK and TEXT blocks');
  return { key: templateKeySchema.parse(template.key), name: template.name, description: template.description,
    themeKey: themeKeySchema.parse(template.themeKey), blocks: blocks as PageTemplate['blocks'] };
}

@Injectable()
export class PagesService {
  constructor(private readonly repository: PagesRepository, private readonly cache: PublicPageCache,
    private readonly config: ConfigService) {}
  private async execute<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); }
    catch (error) {
      if (error instanceof PageInputError) identityError(error.code === 'VALIDATION_ERROR' ? 400 : 409, error.code, error.message);
      if (error instanceof PageResourceError) identityError(404, error.code, error.code.replaceAll('_', ' ').toLowerCase());
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        identityError(409, 'PAGE_SLUG_UNAVAILABLE', 'That page slug is already in use for this account');
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
  addBlock(userId: string, id: string, input: CreateBlockInput) { return this.execute(async () => ({ data: blockDto(await this.repository.addBlock(userId, id, input)) })); }
  updateBlock(userId: string, id: string, blockId: string, input: UpdateBlockInput) { return this.execute(async () => ({ data: blockDto(await this.repository.updateBlock(userId, id, blockId, input)) })); }
  deleteBlock(userId: string, id: string, blockId: string) { return this.execute(async () => { await this.repository.deleteBlock(userId, id, blockId); return { data: { deleted: true } }; }); }
  reorder(userId: string, id: string, input: ReorderBlocksInput) {
    return this.execute(async () => ({ data: ownerDto(await this.repository.reorder(userId, id, input)) }));
  }
  async themes() { return { data: (await this.repository.themes()).map(themeDto) }; }
  async theme(key: string) {
    const theme = await this.repository.theme(key);
    if (!theme || !theme.isSystem) identityError(404, 'THEME_NOT_FOUND', 'Theme not found');
    return { data: themeDto(theme) };
  }
  async templates() { return { data: (await this.repository.templates()).map(templateDto) }; }
  async template(key: string) {
    const template = await this.repository.template(key);
    if (!template) identityError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');
    return { data: templateDto(template) };
  }
  appearance(userId: string, id: string, input: UpdateAppearanceInput) { return this.execute(async () => ({ data: ownerDto(await this.repository.appearance(userId, id, input)) })); }
  applyTemplate(userId: string, id: string, input: ApplyTemplateInput) { return this.execute(async () => ({ data: ownerDto(await this.repository.applyTemplate(userId, id, input)) })); }
  async socials(userId: string, id: string) { return { data: (await this.get(userId, id)).data.socials }; }
  addSocial(userId: string, id: string, input: CreateSocialInput) { return this.execute(async () => ({ data: socialDto(await this.repository.addSocial(userId, id, input)) })); }
  updateSocial(userId: string, id: string, socialId: string, input: UpdateSocialInput) { return this.execute(async () => ({ data: socialDto(await this.repository.updateSocial(userId, id, socialId, input)) })); }
  deleteSocial(userId: string, id: string, socialId: string) { return this.execute(async () => { await this.repository.deleteSocial(userId, id, socialId); return { data: { deleted: true } }; }); }
  reorderSocials(userId: string, id: string, input: ReorderBlocksInput) { return this.execute(async () => ({ data: (await this.repository.reorderSocials(userId, id, input)).socials.map(socialDto) })); }
  async qr(userId: string, id: string): Promise<{ data: { url: string; png: Buffer } }> {
    const page = await this.repository.get(userId, id);
    if (!page) identityError(404, 'PAGE_NOT_FOUND', 'Page not found');
    const base = this.config.getOrThrow<string>('PUBLIC_APP_URL').replace(/\/$/, '');
    const url = `${base}/${encodeURIComponent(page.user.username)}${page.isPrimary ? '' : `/${encodeURIComponent(page.slug)}`}`;
    const png = await QRCode.toBuffer(url, { type: 'png', width: 512, margin: 2, errorCorrectionLevel: 'M' });
    return { data: { url, png } };
  }
  async publicPage(username: string, pageSlug?: string) {
    // Never authorize public visibility from cache. Checking PostgreSQL first also
    // handles suspension/deletion and old usernames while Redis is unavailable.
    const gate = await this.repository.publicGate(username, pageSlug);
    if (!gate) identityError(404, 'PAGE_NOT_FOUND', 'Page not found');
    const routeKey = pageSlug ? `${username}/${pageSlug}` : username;
    const hit = await this.cache.get(this.cache.key(routeKey, gate));
    if (hit) return { data: hit };
    const page = await this.repository.publicSnapshot(username, pageSlug);
    if (!page) identityError(404, 'PAGE_NOT_FOUND', 'Page not found');
    const result: PublicPage = publicPageSchema.parse({
      profile: page.user, page: { id: page.id, slug: page.slug, isPrimary: page.isPrimary, title: page.title, description: page.description, themeKey: page.themeKey, appearance: resolveAppearance(themeConfig(page.theme), page.appearanceOverrides) },
      blocks: page.blocks.map(block => {
        const content = block.type === 'IMAGE' ? { ...(block.content as Record<string, unknown>), url: block.media?.url } : block.content;
        return publicBlockSchema.parse({ id: block.id, type: block.type, content });
      }),
      socials: page.socials.map(social => publicSocialSchema.parse({ id: social.id, platform: social.platform, username: social.username, url: social.url })),
    });
    // Old in-flight readers can populate only their old revision, not the new one.
    await this.cache.set(this.cache.key(routeKey, page), result);
    return { data: result };
  }
}
