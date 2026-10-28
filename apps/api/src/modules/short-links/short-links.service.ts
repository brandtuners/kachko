import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { ShortLink, ShortLinkStats } from '@kachko/types';
import { shortLinkUtmSchema, type CreateShortLinkInput, type UpdateShortLinkInput } from '@kachko/validation';
import type { ShortLink as StoredShortLink } from '../../generated/prisma/client';
import { identityError } from '../identity/identity.service';
import { ShortLinksRepository } from './short-links.repository';

const uniqueError = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

@Injectable()
export class ShortLinksService {
  constructor(private readonly repository: ShortLinksRepository, private readonly config: ConfigService) {}

  private dto(link: StoredShortLink): ShortLink {
    return { id: link.id, code: link.code, title: link.title, destinationUrl: link.destinationUrl, channel: link.channel, tags: link.tags,
      utm: shortLinkUtmSchema.parse(link.utm ?? {}),
      shortUrl: `${this.config.getOrThrow<string>('PUBLIC_APP_URL')}/s/${encodeURIComponent(link.code)}`,
      isActive: link.isActive, clickCount: link.clickCount, createdAt: link.createdAt.toISOString(), updatedAt: link.updatedAt.toISOString() };
  }
  private validateDestination(value: string) {
    const url = new URL(value);
    const origin = this.config.getOrThrow<string>('PUBLIC_APP_URL');
    if (url.origin === origin && /^\/s(?:\/|$)/.test(url.pathname)) {
      identityError(400, 'SHORT_LINK_LOOP', 'Use the final destination instead of another Kachko short link');
    }
  }
  async list(userId: string, cursor?: string) {
    if (cursor && !await this.repository.owned(userId, cursor)) identityError(400, 'INVALID_CURSOR', 'Reload the link list');
    const rows = await this.repository.list(userId, cursor);
    const items = rows.slice(0, 50);
    return { data: { items: items.map(link => this.dto(link)), nextCursor: rows.length > 50 ? items.at(-1)!.id : null } };
  }
  async create(userId: string, input: CreateShortLinkInput) {
    this.validateDestination(input.destinationUrl);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = input.code ?? randomBytes(9).toString('base64url');
      try { return { data: this.dto(await this.repository.create(userId, code, input)) }; }
      catch (error) {
        if (!uniqueError(error)) throw error;
        if (input.code) identityError(409, 'SHORT_CODE_UNAVAILABLE', 'That custom short link is already taken');
      }
    }
    identityError(503, 'SHORT_CODE_UNAVAILABLE', 'Could not allocate a short link. Try again.');
  }
  async update(userId: string, id: string, input: UpdateShortLinkInput) {
    if (input.destinationUrl) this.validateDestination(input.destinationUrl);
    let link: StoredShortLink | null;
    try { link = await this.repository.update(userId, id, input); }
    catch (error) {
      if (uniqueError(error)) identityError(409, 'SHORT_CODE_UNAVAILABLE', 'That custom short link is already taken');
      throw error;
    }
    if (!link) identityError(404, 'SHORT_LINK_NOT_FOUND', 'Short link not found');
    return { data: this.dto(link) };
  }
  async resolve(code: string, request: Request) {
    const ua = request.headers['user-agent'] ?? '';
    const device = /bot|crawler|spider/i.test(ua) ? 'bot' : /ipad|tablet/i.test(ua) ? 'tablet'
      : /mobile|iphone|android/i.test(ua) ? 'mobile' : ua ? 'desktop' : 'unknown';
    let referrer: string | null = null;
    try { const url = new URL(request.headers.referer ?? ''); if (['http:', 'https:'].includes(url.protocol)) referrer = url.origin.slice(0, 500); } catch { /* direct request */ }
    const value = request.headers['x-vercel-ip-country'] ?? request.headers['cf-ipcountry'];
    const rawCountry = Array.isArray(value) ? value[0] : value;
    const country = rawCountry && /^[A-Za-z]{2}$/.test(rawCountry) ? rawCountry.toUpperCase() : null;
    const destination = await this.repository.resolve(code, { device, referrer, country });
    if (!destination) identityError(404, 'SHORT_LINK_NOT_FOUND', 'This short link is unavailable');
    return destination;
  }
  async stats(userId: string, id: string): Promise<{ data: ShortLinkStats }> {
    if (!await this.repository.owned(userId, id)) identityError(404, 'SHORT_LINK_NOT_FOUND', 'Short link not found');
    const from = new Date(); from.setUTCHours(0, 0, 0, 0); from.setUTCDate(from.getUTCDate() - 29);
    const result = await this.repository.stats(id, from);
    const activity: ShortLinkStats['activity'] = [];
    const end = new Date();
    for (const date = new Date(from); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
      const key = date.toISOString().slice(0, 10);
      activity.push({ date: key, clicks: result.activity.find(row => row.date === key)?.clicks ?? 0 });
    }
    return { data: { ...result, periodDays: 30, activity } };
  }
}
