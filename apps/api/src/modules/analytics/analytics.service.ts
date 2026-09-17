import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { AnalyticsEventInput, AnalyticsRangeInput } from '@kachko/validation';
import type { AnalyticsPeriod, AnalyticsRange, AnalyticsSeriesPoint, AnalyticsSummary } from '@kachko/types';
import { identityError } from '../identity/identity.service';
import { AnalyticsRepository, type StoredAnalyticsMetadata } from './analytics.repository';

function header(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
function bounded(value: string | undefined, maximum: number): string | null {
  const clean = value?.trim();
  return clean ? clean.slice(0, maximum) : null;
}
function deviceMetadata(userAgent: string | undefined) {
  const ua = userAgent ?? '';
  const device = /bot|crawler|spider/i.test(ua) ? 'bot' : /ipad|tablet/i.test(ua) ? 'tablet'
    : /mobile|iphone|android/i.test(ua) ? 'mobile' : ua ? 'desktop' : 'unknown';
  const browser = /edg\//i.test(ua) ? 'Edge' : /firefox\//i.test(ua) ? 'Firefox'
    : /chrome\//i.test(ua) ? 'Chrome' : /safari\//i.test(ua) ? 'Safari' : 'Other';
  const os = /windows/i.test(ua) ? 'Windows' : /android/i.test(ua) ? 'Android'
    : /iphone|ipad|ios/i.test(ua) ? 'iOS' : /mac os|macintosh/i.test(ua) ? 'macOS'
      : /linux/i.test(ua) ? 'Linux' : 'Other';
  return { device, browser, os };
}
function referrer(request: Request): string | null {
  const raw = header(request, 'referer');
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.origin.slice(0, 500) : null;
  } catch { return null; }
}
function period(range: AnalyticsRange): { from: Date; to: Date; response: AnalyticsPeriod } {
  const to = new Date();
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  if (range === '7d') from.setUTCDate(from.getUTCDate() - 6);
  if (range === '30d') from.setUTCDate(from.getUTCDate() - 29);
  return { from, to, response: { range, from: from.toISOString(), to: to.toISOString() } };
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository, private readonly config: ConfigService) {}

  private metadata(request: Request): StoredAnalyticsMetadata {
    const forwarded = header(request, 'x-forwarded-for')?.split(',')[0]?.trim();
    const address = forwarded ?? request.ip ?? request.socket.remoteAddress;
    const ipHash = address ? createHmac('sha256', this.config.getOrThrow<string>('ANALYTICS_HASH_SALT')).update(address).digest('hex') : null;
    const countryValue = bounded(header(request, 'x-vercel-ip-country') ?? header(request, 'cf-ipcountry'), 2);
    const country = countryValue && /^[A-Za-z]{2}$/.test(countryValue) ? countryValue.toUpperCase() : null;
    let city = bounded(header(request, 'x-vercel-ip-city'), 100);
    try { city = city ? decodeURIComponent(city) : null; } catch { city = null; }
    return { ipHash, country, city, ...deviceMetadata(header(request, 'user-agent')), referrer: referrer(request) };
  }

  async ingest(input: AnalyticsEventInput, request: Request) {
    const target = await this.repository.target(input.pageId, input.blockId, input.socialProfileId, input.eventType);
    if (!target) {
      identityError(404, 'ANALYTICS_TARGET_NOT_FOUND', 'Published analytics target not found');
    }
    await this.repository.create(input.pageId, target, input.eventType, this.metadata(request));
    return { data: { accepted: true as const } };
  }

  private async ownerPeriod(userId: string, pageId: string, query: AnalyticsRangeInput) {
    if (!await this.repository.ownedPage(userId, pageId)) identityError(404, 'PAGE_NOT_FOUND', 'Page not found');
    return period(query.range);
  }

  async summary(userId: string, pageId: string, query: AnalyticsRangeInput) {
    const selected = await this.ownerPeriod(userId, pageId, query);
    const [counts, uniqueVisitors] = await Promise.all([
      this.repository.counts(pageId, selected.from, selected.to),
      this.repository.uniqueVisitors(pageId, selected.from, selected.to),
    ]);
    const count = (type: string) => counts.find(row => row.eventType === type)?._count._all ?? 0;
    const totalViews = count('PAGE_VIEW');
    const linkClicks = count('LINK_CLICK');
    const result: AnalyticsSummary = { ...selected.response, totalViews, uniqueVisitors, linkClicks,
      socialClicks: count('SOCIAL_CLICK'), clickThroughRate: totalViews ? Number(((linkClicks / totalViews) * 100).toFixed(2)) : 0 };
    return { data: result };
  }

  async timeseries(userId: string, pageId: string, query: AnalyticsRangeInput) {
    const selected = await this.ownerPeriod(userId, pageId, query);
    const rows = await this.repository.timeseries(pageId, selected.from, selected.to);
    const items: AnalyticsSeriesPoint[] = [];
    for (const cursor = new Date(selected.from); cursor <= selected.to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10);
      const count = (type: string) => rows.find(row => row.date === date && row.eventType === type)?.count ?? 0;
      items.push({ date, views: count('PAGE_VIEW'), linkClicks: count('LINK_CLICK'), socialClicks: count('SOCIAL_CLICK') });
    }
    return { data: { ...selected.response, items } };
  }

  private async breakdown<T>(userId: string, pageId: string, query: AnalyticsRangeInput,
    load: (from: Date, to: Date) => Promise<T>) {
    const selected = await this.ownerPeriod(userId, pageId, query);
    return { data: { ...selected.response, items: await load(selected.from, selected.to) } };
  }
  topLinks(userId: string, pageId: string, query: AnalyticsRangeInput) {
    return this.breakdown(userId, pageId, query, (from, to) => this.repository.topLinks(pageId, from, to));
  }
  topSocials(userId: string, pageId: string, query: AnalyticsRangeInput) {
    return this.breakdown(userId, pageId, query, (from, to) => this.repository.topSocials(pageId, from, to));
  }
  referrers(userId: string, pageId: string, query: AnalyticsRangeInput) {
    return this.breakdown(userId, pageId, query, (from, to) => this.repository.referrers(pageId, from, to));
  }
  geo(userId: string, pageId: string, query: AnalyticsRangeInput) {
    return this.breakdown(userId, pageId, query, (from, to) => this.repository.geo(pageId, from, to));
  }
  devices(userId: string, pageId: string, query: AnalyticsRangeInput) {
    return this.breakdown(userId, pageId, query, (from, to) => this.repository.devices(pageId, from, to));
  }
}
