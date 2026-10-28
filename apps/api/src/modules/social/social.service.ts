import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createDmAutomationSchema, type CreateDmAutomationInput, type UpdateDmAutomationInput } from '@kachko/validation';
import { KACHKO_FEATURES } from '@kachko/types';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, type SocialAccount } from '../../generated/prisma/client';
import { RedisService } from '../../redis/redis.service';
import { identityError } from '../identity/identity.service';
import { InstagramProvider } from './instagram.provider';
import { YoutubeProvider } from './youtube.provider';
import { TokenVault } from './token-vault';
import { SocialProviderError } from './social-provider.error';

const randomToken = () => randomBytes(32).toString('base64url');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const utcDay = (date = new Date()) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const safeAccount = (account: SocialAccount) => ({ id: account.id, platform: account.platform, username: account.username,
  avatarUrl: account.avatarUrl, tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
  lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null, status: account.status });
export function commentMatches(matchType: string, keywords: string[], text: string) {
  return matchType === 'ANY' || keywords.some(keyword => text.normalize('NFKC').toLowerCase().includes(keyword.normalize('NFKC').toLowerCase()));
}

@Injectable()
export class SocialService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SocialService.name);
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;
  private activeTick?: Promise<void>;
  private stopping = false;
  constructor(private readonly db: PrismaService, private readonly redis: RedisService,
    private readonly config: ConfigService, private readonly instagram: InstagramProvider,
    private readonly youtube: YoutubeProvider, private readonly vault: TokenVault) {}

  onModuleInit() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    this.timer = setInterval(() => { if (!this.ticking && !this.stopping) this.activeTick = this.tick(); }, 5000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.activeTick;
  }
  status() { return { data: { instagramConfigured: this.instagram.configured(), youtubeConfigured: this.youtube.configured() } }; }
  private provider(platform: string) { return platform === 'INSTAGRAM' ? this.instagram : this.youtube; }
  private async owned(userId: string, accountId: string) {
    const account = await this.db.socialAccount.findFirst({ where: { id: accountId, userId } });
    if (!account) identityError(404, 'SOCIAL_ACCOUNT_NOT_FOUND', 'Connected account not found');
    return account;
  }
  async accounts(userId: string) {
    return { data: (await this.db.socialAccount.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })).map(safeAccount) };
  }
  private redisClient() {
    if (!this.redis.client.isReady) identityError(503, 'DEPENDENCIES_UNAVAILABLE', 'Required services are unavailable');
    return this.redis.client.withCommandOptions({ abortSignal: AbortSignal.timeout(2000) });
  }
  async connect(userId: string, providerName: string) {
    const provider = this.provider(providerName.toUpperCase());
    if (!provider.configured()) identityError(503, 'SOCIAL_NOT_CONFIGURED', 'This social connection is not configured yet');
    const state = randomToken(); const verifier = randomToken();
    await this.redisClient().set(`social:oauth:${hash(state)}`, JSON.stringify({ userId, providerName, verifier }), { EX: 600 });
    const url = providerName === 'youtube' ? this.youtube.authorize(state, verifier) : this.instagram.authorize(state);
    return { state, url };
  }
  async callback(providerName: string, state: string, cookieState: string | undefined, code: string | undefined) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(state) || state !== cookieState) identityError(403, 'SOCIAL_STATE_INVALID', 'Restart the social connection');
    const stored = await this.redisClient().getDel(`social:oauth:${hash(state)}`);
    if (!stored || !code || code.length > 4096) identityError(403, 'SOCIAL_STATE_INVALID', 'Restart the social connection');
    const flow = JSON.parse(stored) as { userId: string; providerName: string; verifier: string };
    if (flow.providerName !== providerName) identityError(403, 'SOCIAL_STATE_INVALID', 'Restart the social connection');
    const provider = this.provider(providerName.toUpperCase());
    const tokens = providerName === 'youtube' ? await this.youtube.exchange(code, flow.verifier) : await this.instagram.exchange(code);
    const profile = await provider.profile(tokens.accessToken);
    const platform = providerName.toUpperCase();
    const refreshToken = 'refreshToken' in tokens && typeof tokens.refreshToken === 'string' ? this.vault.encrypt(tokens.refreshToken) : undefined;
    const account = await this.db.$transaction(async tx => {
      const users = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE "id" = ${flow.userId} AND "isActive" = true AND "deletedAt" IS NULL FOR UPDATE`;
      if (!users.length) identityError(401, 'UNAUTHENTICATED', 'Sign in to continue');
      const existing = await tx.socialAccount.findUnique({ where: { platform_externalId: { platform, externalId: profile.externalId } } });
      if (existing && existing.userId !== flow.userId) identityError(409, 'SOCIAL_ACCOUNT_LINKED', 'This social account is connected to another Kachko account');
      const data = { username: profile.username, avatarUrl: profile.avatarUrl, accessToken: this.vault.encrypt(tokens.accessToken),
        ...(refreshToken ? { refreshToken } : {}), tokenExpiresAt: tokens.expiresAt, scopes: tokens.scopes, status: 'CONNECTED',
        lastSyncError: null, nextSyncAt: new Date(), report: {} };
      return existing ? tx.socialAccount.update({ where: { id: existing.id }, data }) : tx.socialAccount.create({
        data: { userId: flow.userId, platform, externalId: profile.externalId, ...data } });
    });
    if (platform === 'INSTAGRAM') {
      try { await this.instagram.subscribe(profile.externalId, tokens.accessToken); }
      catch { await this.db.socialAccount.update({ where: { id: account.id }, data: { status: 'RECONNECT_REQUIRED', lastSyncError: 'INSTAGRAM_WEBHOOK_SUBSCRIPTION_FAILED' } }); }
    }
    return safeAccount(account);
  }
  async disconnect(userId: string, accountId: string) {
    const account = await this.owned(userId, accountId);
    // Stop queued jobs before revocation, including on another replica.
    await this.db.socialAccount.update({ where: { id: accountId }, data: { status: 'DISCONNECTING' } });
    try { await this.provider(account.platform).revoke(this.vault.decrypt(account.accessToken)); }
    catch { /* Local disconnect still removes credentials and all queued work. */ }
    await this.db.socialAccount.delete({ where: { id: accountId } });
    return { data: { disconnected: true } };
  }
  async deleteInstagramData(externalId: string) {
    await this.db.socialAccount.deleteMany({ where: { platform: 'INSTAGRAM', externalId } });
    const nonce = randomToken();
    const signature = createHmac('sha256', this.config.getOrThrow<string>('SOCIAL_INSTAGRAM_CLIENT_SECRET')).update(`deleted:${nonce}`).digest('base64url');
    return `${nonce}.${signature}`;
  }
  deletionStatus(code: string) {
    if (!/^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/.test(code)) identityError(404, 'DELETION_NOT_FOUND', 'Deletion confirmation not found');
    const [nonce, signature] = code.split('.');
    const secret = this.config.get<string>('SOCIAL_INSTAGRAM_CLIENT_SECRET');
    if (!secret) identityError(404, 'DELETION_NOT_FOUND', 'Deletion confirmation not found');
    const expected = createHmac('sha256', secret).update(`deleted:${nonce}`).digest();
    const actual = Buffer.from(signature!, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) identityError(404, 'DELETION_NOT_FOUND', 'Deletion confirmation not found');
    return { data: { status: 'complete' } };
  }
  private async token(account: SocialAccount) {
    let accessToken = this.vault.decrypt(account.accessToken);
    const threshold = account.platform === 'INSTAGRAM' ? 2 * 86_400_000 : 5 * 60_000;
    if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() < Date.now() + threshold) {
      if (account.tokenExpiresAt.getTime() <= Date.now() && account.platform === 'INSTAGRAM') throw new SocialProviderError('TOKEN_EXPIRED', true);
      const refresh = account.refreshToken ? this.vault.decrypt(account.refreshToken) : undefined;
      const next = account.platform === 'INSTAGRAM' ? await this.instagram.refresh(accessToken) : await this.youtube.refresh(accessToken, refresh);
      accessToken = next.accessToken;
      await this.db.socialAccount.update({ where: { id: account.id }, data: { accessToken: this.vault.encrypt(accessToken),
        tokenExpiresAt: next.expiresAt, ...('refreshToken' in next && next.refreshToken ? { refreshToken: this.vault.encrypt(next.refreshToken) } : {}),
        ...(next.scopes.length ? { scopes: next.scopes } : {}) } });
    }
    return accessToken;
  }
  async sync(userId: string, accountId: string) {
    const account = await this.owned(userId, accountId);
    if (account.status !== 'CONNECTED') identityError(409, 'SOCIAL_RECONNECT_REQUIRED', 'Reconnect this social account');
    const now = new Date();
    const claim = await this.db.socialAccount.updateMany({ where: { id: accountId, status: 'CONNECTED',
      OR: [{ syncLeaseUntil: null }, { syncLeaseUntil: { lt: now } }] }, data: { syncLeaseUntil: new Date(now.getTime() + 5 * 60_000) } });
    if (!claim.count) identityError(409, 'SOCIAL_SYNC_RUNNING', 'This social account is already syncing');
    try {
      const token = await this.token(account);
      const result = account.platform === 'INSTAGRAM' ? await this.instagram.collect(account.externalId, token) : await this.youtube.collect(account.externalId, token);
      await this.db.$transaction(async tx => {
        for (const day of result.history) {
          const date = new Date(`${day.date}T00:00:00Z`);
          if (!Number.isFinite(date.getTime())) continue;
          const data = { views: day.views === null ? null : BigInt(day.views), reach: day.reach };
          await tx.socialSnapshot.upsert({ where: { accountId_date: { accountId, date } }, create: { accountId, date, ...data }, update: data });
        }
        const profileData = { followers: result.profile.followers, posts: result.profile.posts };
        const date = utcDay();
        await tx.socialSnapshot.upsert({ where: { accountId_date: { accountId, date } }, create: { accountId, date, ...profileData }, update: profileData });
        for (const item of result.media) {
          if (!Number.isFinite(item.publishedAt.getTime())) continue;
          const data = { ...item, views: item.views === null ? null : BigInt(item.views) };
          await tx.socialMedia.upsert({ where: { accountId_externalId: { accountId, externalId: item.externalId } }, create: { accountId, ...data },
            update: { ...data, ...(data.views === null ? { views: undefined } : {}) } });
        }
        await tx.socialAccount.update({ where: { id: accountId }, data: { username: result.profile.username, avatarUrl: result.profile.avatarUrl,
          report: result.totals as Prisma.InputJsonObject, lastSyncedAt: now, lastSyncError: null, nextSyncAt: new Date(now.getTime() + 6 * 60 * 60_000) } });
      });
      return { data: { synced: true } };
    } catch (error) {
      const safe = error instanceof SocialProviderError ? error : new SocialProviderError('SOCIAL_SYNC_FAILED');
      await this.db.socialAccount.updateMany({ where: { id: accountId }, data: { lastSyncError: safe.code,
        ...(safe.reconnect ? { status: 'RECONNECT_REQUIRED' } : {}), nextSyncAt: new Date(Date.now() + 60 * 60_000) } });
      identityError(502, safe.reconnect ? 'SOCIAL_RECONNECT_REQUIRED' : 'SOCIAL_SYNC_FAILED', safe.reconnect ? 'Reconnect this social account' : 'The social provider could not refresh insights. Please try again later.');
    } finally {
      await this.db.socialAccount.updateMany({ where: { id: accountId }, data: { syncLeaseUntil: null } });
    }
  }
  async media(userId: string, accountId: string, includeMetrics = true) {
    await this.owned(userId, accountId);
    const media = await this.db.socialMedia.findMany({ where: { accountId }, orderBy: { publishedAt: 'desc' }, take: 100 });
    return { data: media.map(item => ({ id: item.externalId, caption: item.caption, permalink: item.permalink,
      mediaType: item.mediaType, publishedAt: item.publishedAt.toISOString(), likes: includeMetrics ? item.likes : null,
      comments: includeMetrics ? item.comments : null, views: !includeMetrics || item.views === null ? null : Number(item.views) })) };
  }
  async analytics(userId: string, accountId: string, range: string) {
    const account = await this.owned(userId, accountId);
    const from = utcDay(); from.setUTCDate(from.getUTCDate() - (range === '7d' ? 6 : range === '90d' ? 89 : 29));
    const history = await this.db.socialSnapshot.findMany({ where: { accountId, date: { gte: from } }, orderBy: { date: 'asc' } });
    const latest = [...history].reverse().find(day => day.followers !== null);
    const earliest = history.find(day => day.followers !== null && day.date < (latest?.date ?? from));
    const report = account.report as { views?: number | null; reach?: number | null; demographics?: Prisma.JsonValue };
    return { data: { followers: latest?.followers ?? null,
      followersChange: earliest?.followers !== undefined && earliest.followers !== null && latest?.followers !== null && latest?.followers !== undefined
        ? latest.followers - earliest.followers : null,
      posts: [...history].reverse().find(day => day.posts !== null)?.posts ?? null, views: range === '30d' ? report.views ?? null : null,
      reach: range === '30d' ? report.reach ?? null : null, history: history.map(day => ({ date: day.date.toISOString().slice(0, 10),
        followers: day.followers, views: day.views === null ? null : Number(day.views), reach: day.reach })),
      media: (await this.media(userId, accountId)).data, demographics: report.demographics ?? null,
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null } };
  }
  async automations(userId: string) {
    const items = await this.db.dmAutomation.findMany({ where: { account: { userId }, deletedAt: null }, orderBy: { createdAt: 'desc' } });
    return { data: await Promise.all(items.map(async item => {
      const stats = await this.db.dmDelivery.aggregate({ where: { automationId: item.id }, _sum: { clickCount: true } });
      const [sends, failed] = await Promise.all([this.db.dmDelivery.count({ where: { automationId: item.id, status: 'SENT' } }),
        this.db.dmDelivery.count({ where: { automationId: item.id, status: { in: ['FAILED', 'UNKNOWN'] } } })]);
      return { ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), sends, failed, clicks: stats._sum.clickCount ?? 0 };
    })) };
  }
  async usage(userId: string) {
    const accounts = await this.db.socialAccount.findMany({ where: { userId, platform: 'INSTAGRAM' }, select: { id: true } });
    const month = utcDay(); month.setUTCDate(1);
    const reset = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
    return { data: await Promise.all(accounts.map(async account => ({ accountId: account.id,
      used: await this.db.dmDelivery.count({ where: { accountId: account.id, claimedAt: { gte: month }, status: { in: ['SENT', 'SENDING', 'UNKNOWN'] } } }),
      limit: this.config.get<number>('SOCIAL_DM_MONTHLY_LIMIT', 2500), resetAt: reset.toISOString() }))) };
  }
  private validateMessage(input: CreateDmAutomationInput) {
    const sampleUrl = `${this.config.getOrThrow<string>('PUBLIC_APP_URL')}/d/${'a'.repeat(43)}`;
    if (`${input.message}\n\n${input.buttonLabel}: ${sampleUrl}`.length > 1000) identityError(400, 'DM_MESSAGE_TOO_LONG', 'Shorten the message so its link also fits in the Instagram reply');
  }
  async createAutomation(userId: string, input: CreateDmAutomationInput) {
    this.validateMessage(input);
    const account = await this.owned(userId, input.accountId);
    if (account.platform !== 'INSTAGRAM' || account.status !== 'CONNECTED') identityError(400, 'INSTAGRAM_REQUIRED', 'Connect an Instagram professional account first');
    if (input.triggerType === 'SPECIFIC_POST' && !await this.db.socialMedia.findUnique({
      where: { accountId_externalId: { accountId: account.id, externalId: input.mediaId! } } })) {
      identityError(400, 'MEDIA_NOT_FOUND', 'Choose one of this account’s synced posts');
    }
    if (await this.db.dmAutomation.count({ where: { accountId: account.id, deletedAt: null } }) >= 100) identityError(409, 'AUTOMATION_LIMIT', 'This account has reached its automation limit');
    const item = await this.db.dmAutomation.create({ data: { ...input, mediaId: input.triggerType === 'SPECIFIC_POST' ? input.mediaId : null } });
    return { data: item };
  }
  async updateAutomation(userId: string, id: string, patch: UpdateDmAutomationInput) {
    const stored = await this.db.dmAutomation.findFirst({ where: { id, deletedAt: null, account: { userId } } });
    if (!stored) identityError(404, 'AUTOMATION_NOT_FOUND', 'Automation not found');
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, deletedAt: _deletedAt, triggerStartedAt: _startedAt, ...config } = stored;
    void _id; void _createdAt; void _updatedAt; void _deletedAt; void _startedAt;
    const input = createDmAutomationSchema.parse({ ...config, ...patch });
    this.validateMessage(input);
    const account = await this.owned(userId, input.accountId);
    if (account.platform !== 'INSTAGRAM') identityError(400, 'INSTAGRAM_REQUIRED', 'Choose an Instagram account');
    if (input.triggerType === 'SPECIFIC_POST' && !await this.db.socialMedia.findUnique({ where: { accountId_externalId: { accountId: account.id, externalId: input.mediaId! } } })) {
      identityError(400, 'MEDIA_NOT_FOUND', 'Choose one of this account’s synced posts');
    }
    const item = await this.db.dmAutomation.update({ where: { id }, data: { ...input,
      ...(stored.triggerType !== input.triggerType || stored.accountId !== input.accountId ? { triggerStartedAt: new Date() } : {}),
      mediaId: input.triggerType === 'ALL_POSTS' ? null : input.triggerType === 'NEXT_POST'
        ? (stored.triggerType === 'NEXT_POST' && stored.accountId === input.accountId ? stored.mediaId : null) : input.mediaId } });
    return { data: item };
  }
  async deleteAutomation(userId: string, id: string) {
    const result = await this.db.dmAutomation.updateMany({ where: { id, deletedAt: null, account: { userId } }, data: { isActive: false, deletedAt: new Date() } });
    if (!result.count) identityError(404, 'AUTOMATION_NOT_FOUND', 'Automation not found');
    return { data: { deleted: true } };
  }
  async deliveries(userId: string, automationId: string, cursor?: string) {
    const automation = await this.db.dmAutomation.findFirst({ where: { id: automationId, account: { userId } }, select: { id: true } });
    if (!automation) identityError(404, 'AUTOMATION_NOT_FOUND', 'Automation not found');
    if (cursor && !await this.db.dmDelivery.findFirst({ where: { id: cursor, automationId }, select: { id: true } })) {
      identityError(400, 'INVALID_CURSOR', 'Reload the delivery history');
    }
    const rows = await this.db.dmDelivery.findMany({ where: { automationId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 26, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    const items = rows.slice(0, 25).map(item => ({ id: item.id, status: item.status, errorCode: item.errorCode,
      createdAt: item.createdAt.toISOString(), sentAt: item.sentAt?.toISOString() ?? null, clicks: item.clickCount,
      nextAttemptAt: item.nextAttemptAt.toISOString(),
      canRetry: item.status === 'FAILED' && Date.now() - item.commentCreatedAt.getTime() < 7 * 86_400_000 }));
    return { data: { items, nextCursor: rows.length > 25 ? rows[24]!.id : null } };
  }
  async retryDelivery(userId: string, id: string) {
    return this.db.$transaction(async tx => {
      const item = await tx.dmDelivery.findFirst({ where: { id, account: { userId } }, include: { account: { include: { user: true } }, automation: true } });
      if (!item) identityError(404, 'DELIVERY_NOT_FOUND', 'Delivery not found');
      if (item.status !== 'FAILED') identityError(409, 'DELIVERY_NOT_RETRYABLE', 'Only confirmed failed replies can be retried. Uncertain sends are never resent.');
      if (!item.automation.isActive || item.automation.deletedAt || item.automation.accountId !== item.accountId || item.account.status !== 'CONNECTED') {
        identityError(409, 'AUTOMATION_NOT_READY', 'Reconnect the account and enable this automation before retrying');
      }
      if (!item.account.user.isActive || item.account.user.deletedAt || !item.account.user.billingFeatures.includes(KACHKO_FEATURES.AUTOMATIONS)) {
        identityError(403, 'FEATURE_REQUIRED', 'An active account and automations plan are required');
      }
      if (Date.now() - item.commentCreatedAt.getTime() >= 7 * 86_400_000) identityError(409, 'COMMENT_EXPIRED', 'The reply window for this comment has expired');
      const result = await tx.dmDelivery.updateMany({ where: { id, status: 'FAILED' }, data: { status: 'PENDING', nextAttemptAt: new Date(), errorCode: null } });
      if (!result.count) identityError(409, 'DELIVERY_NOT_RETRYABLE', 'This reply is already queued or was processed');
      return { data: { queued: true } };
    });
  }
  async dmDestination(clickToken: string) {
    const delivery = await this.db.dmDelivery.findFirst({ where: { clickToken, status: { in: ['SENT', 'UNKNOWN', 'SENDING'] },
      account: { user: { isActive: true, deletedAt: null } } } });
    if (!delivery) identityError(404, 'LINK_NOT_FOUND', 'Link not found');
    await this.db.dmDelivery.update({ where: { id: delivery.id }, data: { clickCount: { increment: 1 } } });
    return delivery.destinationUrl;
  }

  async receiveComments(body: unknown) {
    const payload = body as { object?: string; entry?: Array<{ id?: string; time?: number; changes?: Array<{ field?: string; value?: {
      id?: string; text?: string; from?: { id?: string }; media?: { id?: string; media_product_type?: string }; timestamp?: string } }> }> };
    if (payload?.object !== 'instagram' || !Array.isArray(payload.entry)) return;
    for (const entry of payload.entry.slice(0, 100)) {
      if (!entry.id) continue;
      const account = await this.db.socialAccount.findUnique({ where: { platform_externalId: { platform: 'INSTAGRAM', externalId: entry.id } } });
      if (!account || account.status !== 'CONNECTED') continue;
      for (const change of (entry.changes ?? []).slice(0, 100)) {
        const value = change.value;
        if (change.field !== 'comments' || !value?.id || !value.media?.id || value.from?.id === entry.id || typeof value.text !== 'string') continue;
        if (!/^\d{1,50}$/.test(value.id) || !/^\d{1,50}$/.test(value.media.id)) continue;
        const occurredAt = new Date(value.timestamp ?? Number(entry.time) * 1000);
        if (!Number.isFinite(occurredAt.getTime()) || occurredAt.getTime() > Date.now() + 60_000) continue;
        // Prisma can emulate an empty-update upsert as read-then-insert, which
        // races when Meta delivers the same comment to multiple replicas.
        await this.db.socialCommentEvent.createMany({ skipDuplicates: true,
          data: [{ accountId: account.id, commentId: value.id, mediaId: value.media.id, text: value.text.slice(0, 2200), occurredAt }] });
      }
    }
  }
  private async processEvent(id: string) {
    const event = await this.db.socialCommentEvent.findUnique({ where: { id }, include: { account: { include: { user: true } } } });
    if (!event) return;
    const account = event.account;
    if (account.status !== 'CONNECTED' || !account.user.isActive || account.user.deletedAt || !account.user.billingFeatures.includes(KACHKO_FEATURES.AUTOMATIONS)) {
      await this.db.socialCommentEvent.update({ where: { id }, data: { status: 'SKIPPED', text: '' } }); return;
    }
    const token = await this.token(account);
    const comment = await this.instagram.comment(event.commentId, token);
    const commentTime = new Date(String(comment.timestamp ?? ''));
    if (!Number.isFinite(commentTime.getTime()) || Date.now() - commentTime.getTime() >= 7 * 86_400_000) {
      await this.db.socialCommentEvent.update({ where: { id }, data: { status: 'SKIPPED', text: '', errorCode: 'COMMENT_EXPIRED' } }); return;
    }
    const pendingNext = await this.db.dmAutomation.findFirst({ where: { accountId: account.id, isActive: true, deletedAt: null, triggerType: 'NEXT_POST', mediaId: null } });
    if (pendingNext) {
      const media = await this.instagram.media(account.externalId, token);
      for (const item of media) {
        const { views: _views, ...update } = item;
        void _views;
        await this.db.socialMedia.upsert({ where: { accountId_externalId: { accountId: account.id, externalId: item.externalId } },
          create: { accountId: account.id, ...item }, update });
      }
    }
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "SocialAccount" WHERE "id" = ${account.id} FOR UPDATE`;
      const rules = await tx.dmAutomation.findMany({ where: { accountId: account.id, isActive: true, deletedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      for (const rule of rules) {
        if (commentTime < rule.createdAt) continue;
        let mediaId = rule.mediaId;
        if (rule.triggerType === 'NEXT_POST' && !mediaId) {
          const next = await tx.socialMedia.findFirst({ where: { accountId: account.id, publishedAt: { gt: rule.triggerStartedAt } }, orderBy: { publishedAt: 'asc' } });
          if (!next) continue;
          mediaId = next.externalId;
          await tx.dmAutomation.update({ where: { id: rule.id }, data: { mediaId } });
        }
        if (rule.triggerType !== 'ALL_POSTS' && mediaId !== event.mediaId) continue;
        if (!commentMatches(rule.matchType, rule.keywords, String(comment.text ?? event.text))) continue;
        await tx.dmDelivery.upsert({ where: { accountId_commentId: { accountId: account.id, commentId: event.commentId } }, create: {
          accountId: account.id, automationId: rule.id, commentId: event.commentId, mediaId: event.mediaId, commentCreatedAt: commentTime,
          message: rule.message, buttonLabel: rule.buttonLabel, destinationUrl: rule.destinationUrl, publicReply: rule.publicReply, clickToken: randomToken(),
        }, update: {} });
        break;
      }
      await tx.socialCommentEvent.update({ where: { id }, data: { status: 'DONE', text: '' } });
    });
  }
  private async sendDelivery(id: string) {
    const delivery = await this.db.$transaction(async tx => {
      const initial = await tx.dmDelivery.findUnique({ where: { id } });
      if (!initial) return null;
      await tx.$queryRaw`SELECT "id" FROM "SocialAccount" WHERE "id" = ${initial.accountId} FOR UPDATE`;
      const item = await tx.dmDelivery.findUnique({ where: { id }, include: { account: { include: { user: true } }, automation: true } });
      if (!item || item.status !== 'PENDING') return null;
      const reason = !item.automation.isActive || item.automation.deletedAt ? 'AUTOMATION_PAUSED'
        : item.automation.accountId !== item.accountId ? 'AUTOMATION_MOVED'
          : item.account.status !== 'CONNECTED' ? 'ACCOUNT_RECONNECT_REQUIRED'
            : !item.account.user.isActive || item.account.user.deletedAt ? 'OWNER_INACTIVE'
              : !item.account.user.billingFeatures.includes(KACHKO_FEATURES.AUTOMATIONS) ? 'PLAN_REQUIRED'
                : Date.now() - item.commentCreatedAt.getTime() >= 7 * 86_400_000 ? 'COMMENT_EXPIRED' : null;
      if (reason) { await tx.dmDelivery.update({ where: { id }, data: { status: 'SKIPPED', errorCode: reason } }); return null; }
      const month = new Date(); month.setUTCDate(1); month.setUTCHours(0, 0, 0, 0);
      const usageStates = ['SENT', 'SENDING', 'UNKNOWN'];
      const monthSends = await tx.dmDelivery.count({ where: { accountId: item.accountId, claimedAt: { gte: month }, status: { in: usageStates } } });
      if (monthSends >= this.config.get<number>('SOCIAL_DM_MONTHLY_LIMIT', 2500)) {
        await tx.dmDelivery.update({ where: { id }, data: { status: 'SKIPPED', errorCode: 'MONTHLY_LIMIT' } }); return null;
      }
      const hourSends = await tx.dmDelivery.count({ where: { accountId: item.accountId, claimedAt: { gte: new Date(Date.now() - 60 * 60_000) }, status: { in: usageStates } } });
      if (hourSends >= 700) {
        await tx.dmDelivery.update({ where: { id }, data: { nextAttemptAt: new Date(Date.now() + 5 * 60_000), errorCode: 'HOURLY_LIMIT' } });
        return null;
      }
      await tx.dmDelivery.update({ where: { id }, data: { status: 'SENDING', claimedAt: new Date(), errorCode: null } });
      return item;
    });
    if (!delivery) return;
    try {
      const token = await this.token(delivery.account);
      const url = `${this.config.getOrThrow<string>('PUBLIC_APP_URL')}/d/${delivery.clickToken}`;
      const messageId = await this.instagram.sendPrivateReply(delivery.account.externalId, token, delivery.commentId, delivery.message, delivery.buttonLabel, url);
      await this.db.dmDelivery.update({ where: { id }, data: { status: 'SENT', providerMessageId: messageId, sentAt: new Date() } });
      if (delivery.publicReply) {
        try { await this.instagram.replyPublic(delivery.commentId, token, delivery.publicReply); }
        catch { await this.db.dmDelivery.update({ where: { id }, data: { errorCode: 'PUBLIC_REPLY_FAILED' } }); }
      }
    } catch (error) {
      const provider = error instanceof SocialProviderError ? error : new SocialProviderError('SEND_UNCONFIRMED', false, true);
      await this.db.dmDelivery.updateMany({ where: { id }, data: { status: provider.ambiguous ? 'UNKNOWN' : 'FAILED', errorCode: provider.code } });
      if (provider.reconnect) await this.db.socialAccount.updateMany({ where: { id: delivery.accountId }, data: { status: 'RECONNECT_REQUIRED' } });
    }
  }
  async tick() {
    if (this.ticking || this.stopping) return;
    this.ticking = true;
    try {
      const stale = new Date(Date.now() - 5 * 60_000);
      await this.db.socialCommentEvent.updateMany({ where: { status: 'PROCESSING', claimedAt: { lt: stale }, attempts: { gte: 5 } },
        data: { status: 'FAILED', text: '', errorCode: 'PROCESSING_EXHAUSTED' } });
      await this.db.socialCommentEvent.updateMany({ where: { status: 'PROCESSING', claimedAt: { lt: stale } }, data: { status: 'PENDING' } });
      // A crash after sending has an uncertain outcome. Never send it again.
      await this.db.dmDelivery.updateMany({ where: { status: 'SENDING', claimedAt: { lt: stale } }, data: { status: 'UNKNOWN', errorCode: 'SEND_UNCONFIRMED' } });
      const events = await this.db.socialCommentEvent.findMany({ where: { status: 'PENDING', attempts: { lt: 5 }, nextAttemptAt: { lte: new Date() } }, orderBy: { createdAt: 'asc' }, take: 5 });
      for (const event of events) {
        const claim = await this.db.socialCommentEvent.updateMany({ where: { id: event.id, status: 'PENDING' }, data: { status: 'PROCESSING', claimedAt: new Date(), attempts: { increment: 1 } } });
        if (!claim.count) continue;
        try { await this.processEvent(event.id); }
        catch (error) {
          const reconnect = error instanceof SocialProviderError && error.reconnect;
          const terminal = reconnect || event.attempts >= 4;
          await this.db.socialCommentEvent.updateMany({ where: { id: event.id }, data: { status: terminal ? 'FAILED' : 'PENDING',
            nextAttemptAt: new Date(Date.now() + 15_000 * 2 ** event.attempts), ...(terminal ? { text: '' } : {}),
            errorCode: error instanceof SocialProviderError ? error.code : 'PROCESSING_FAILED' } });
          if (reconnect) await this.db.socialAccount.updateMany({ where: { id: event.accountId }, data: { status: 'RECONNECT_REQUIRED' } });
        }
      }
      const deliveries = await this.db.dmDelivery.findMany({ where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } }, orderBy: { createdAt: 'asc' }, take: 10 });
      for (const item of deliveries) await this.sendDelivery(item.id);
      const account = await this.db.socialAccount.findFirst({ where: { status: 'CONNECTED', nextSyncAt: { lte: new Date() },
        user: { isActive: true, deletedAt: null }, OR: [{ syncLeaseUntil: null }, { syncLeaseUntil: { lt: new Date() } }] }, orderBy: { nextSyncAt: 'asc' } });
      if (account) { try { await this.sync(account.userId, account.id); } catch { /* Retry follows nextSyncAt. */ } }
    } catch { this.logger.warn('Social background processing failed; pending jobs remain stored for the next pass'); }
    finally { this.ticking = false; }
  }
}
