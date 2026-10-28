const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { randomUUID, randomBytes } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { ConfigService } = require('@nestjs/config');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../../dist/generated/prisma/client');
const { SocialService } = require('../../dist/modules/social/social.service');
const { TokenVault } = require('../../dist/modules/social/token-vault');
const { SocialProviderError } = require('../../dist/modules/social/social-provider.error');
const { ShortLinksService } = require('../../dist/modules/short-links/short-links.service');
const { ShortLinksRepository } = require('../../dist/modules/short-links/short-links.repository');
const exec = promisify(execFile);
const docker = async (...args) => (await exec('docker', args, { timeout: 120_000 })).stdout.trim();

test('social jobs and short links enforce ownership, deduplicate delivery, and respect persisted entitlements in PostgreSQL', { timeout: 120_000 }, async t => {
  const name = `kachko-social-${randomUUID().slice(0, 8)}`;
  let created = false;
  let db;
  t.after(async () => { try { if (db) await db.$disconnect(); } finally { if (created) await docker('rm', '--force', '--volumes', name); } });
  await docker('run', '-d', '--name', name, '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_USER=kachko',
    '-e', 'POSTGRES_PASSWORD=test_only', '-e', 'POSTGRES_DB=kachko_social_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine');
  created = true;
  const port = (await docker('port', name, '5432/tcp')).split(':').at(-1);
  const connectionString = `postgresql://kachko:test_only@127.0.0.1:${port}/kachko_social_test`;
  for (let i = 0; i < 40; i++) {
    try { await docker('exec', name, 'pg_isready', '-U', 'kachko', '-d', 'kachko_social_test'); break; }
    catch { await delay(250); }
  }
  await exec('pnpm', ['-w', 'db:deploy'], { env: { ...process.env, DATABASE_URL: connectionString }, timeout: 60_000 });
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const config = new ConfigService({ NODE_ENV: 'test', PUBLIC_APP_URL: 'https://kachko.example', SOCIAL_DM_MONTHLY_LIMIT: 10,
    SOCIAL_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'), SOCIAL_INSTAGRAM_CLIENT_SECRET: 'fixture-secret' });
  const vault = new TokenVault(config);
  const owner = await db.user.create({ data: { username: 'social_owner', email: 'owner@example.test', billingFeatures: ['automations', 'advanced_analytics'] } });
  const stranger = await db.user.create({ data: { username: 'social_stranger', email: 'stranger@example.test' } });
  const account = await db.socialAccount.create({ data: { userId: owner.id, platform: 'INSTAGRAM', externalId: '123', username: 'creator',
    accessToken: vault.encrypt('test-token'), nextSyncAt: new Date('2099-01-01'), scopes: ['instagram_business_manage_comments'] } });
  const post = await db.socialMedia.create({ data: { accountId: account.id, externalId: '987', mediaType: 'IMAGE', publishedAt: new Date() } });
  let sends = 0;
  const instagram = { comment: async id => ({ id, text: 'send LINK please', timestamp: new Date().toISOString() }),
    sendPrivateReply: async (_account, token, commentId) => { assert.equal(token, 'test-token'); sends++;
      if (commentId === '444') throw new SocialProviderError('SEND_TIMEOUT', false, true);
      return 'message-1'; }, replyPublic: async () => {}, revoke: async () => {} };
  const service = new SocialService(db, {}, config, instagram, {}, vault);
  const secondWorker = new SocialService(db, {}, config, instagram, {}, vault);
  const automation = (await service.createAutomation(owner.id, { accountId: account.id, name: 'Launch', triggerType: 'SPECIFIC_POST', mediaId: post.externalId,
    matchType: 'KEYWORDS', keywords: ['link'], message: 'Here it is', buttonLabel: 'Open', destinationUrl: 'https://example.com/', publicReply: null, isActive: true })).data;
  await assert.rejects(service.analytics(stranger.id, account.id, '30d'), error => error.getStatus() === 404);
  await assert.rejects(service.updateAutomation(stranger.id, automation.id, { name: 'Stolen' }), error => error.getStatus() === 404);
  const renamed = await service.updateAutomation(owner.id, automation.id, { name: 'Renamed' });
  assert.deepEqual(renamed.data.keywords, ['link']);
  const event = commentId => ({ object: 'instagram', entry: [{ id: '123', time: Math.floor(Date.now() / 1000),
    changes: [{ field: 'comments', value: { id: commentId, text: 'link', from: { id: '555' }, media: { id: '987' } } }] }] });
  await Promise.all(Array.from({ length: 10 }, (_, index) =>
    (index % 2 ? service : secondWorker).receiveComments(event('111'))));
  assert.equal(await db.socialCommentEvent.count(), 1);
  await Promise.all([service.tick(), secondWorker.tick()]);
  assert.equal(sends, 1);
  let sent = await db.dmDelivery.findFirst({ where: { commentId: '111' } });
  assert.equal(sent.status, 'SENT');
  assert.equal(await service.dmDestination(sent.clickToken), 'https://example.com/');
  assert.equal((await db.dmDelivery.findUnique({ where: { id: sent.id } })).clickCount, 1);
  await service.receiveComments(event('111')); await service.tick();
  assert.equal(sends, 1);

  await db.user.update({ where: { id: owner.id }, data: { billingFeatures: [] } });
  await service.receiveComments(event('222')); await service.tick();
  assert.equal(sends, 1);
  assert.equal((await db.socialCommentEvent.findFirst({ where: { commentId: '222' } })).status, 'SKIPPED');
  await db.user.update({ where: { id: owner.id }, data: { billingFeatures: ['automations'] } });
  config.set('SOCIAL_DM_MONTHLY_LIMIT', 1);
  await service.receiveComments(event('333')); await service.tick();
  assert.equal(sends, 1);
  assert.equal((await db.dmDelivery.findFirst({ where: { commentId: '333' } })).errorCode, 'MONTHLY_LIMIT');
  config.set('SOCIAL_DM_MONTHLY_LIMIT', 10);
  await service.receiveComments(event('444')); await service.tick();
  assert.equal(sends, 2);
  const uncertain = await db.dmDelivery.findFirst({ where: { commentId: '444' } });
  assert.equal(uncertain.status, 'UNKNOWN');
  assert.equal(await service.dmDestination(uncertain.clickToken), 'https://example.com/');
  await service.tick(); assert.equal(sends, 2);
  await db.socialMedia.update({ where: { id: post.id }, data: { views: 200n } });
  instagram.collect = async () => ({ profile: { externalId: '123', username: 'creator', avatarUrl: null, followers: null, posts: 12 },
    history: [], media: [{ externalId: '987', caption: null, permalink: null, mediaType: 'IMAGE', publishedAt: post.publishedAt,
      likes: null, comments: null, views: null }], totals: { views: null, reach: null } });
  await service.sync(owner.id, account.id);
  assert.equal((await db.socialMedia.findUnique({ where: { id: post.id } })).views, 200n);
  assert.equal((await service.analytics(owner.id, account.id, '30d')).data.posts, 12);
  await service.deleteAutomation(owner.id, automation.id);
  assert.equal((await service.automations(owner.id)).data.length, 0);
  assert.equal(await service.dmDestination(sent.clickToken), 'https://example.com/');

  const shortener = new ShortLinksService(new ShortLinksRepository(db), config);
  const short = (await shortener.create(owner.id, { destinationUrl: 'https://example.com/', code: 'launch', tags: ['launch'], channel: 'Instagram DM' })).data;
  const request = { headers: { 'user-agent': 'iPhone', referer: 'https://instagram.com/path?private=value' } };
  assert.equal(await shortener.resolve(short.code, request), 'https://example.com/');
  assert.equal((await db.shortLink.findUnique({ where: { id: short.id } })).clickCount, 1);
  await shortener.update(owner.id, short.id, { code: 'new-launch', utm: { source: 'instagram', campaign: 'Summer sale' } });
  const tracked = new URL(await shortener.resolve('launch', request));
  assert.equal(tracked.searchParams.get('utm_source'), 'instagram');
  assert.equal(tracked.searchParams.get('utm_campaign'), 'Summer sale');
  assert.equal(await shortener.resolve('new-launch', request), tracked.href);
  await assert.rejects(shortener.create(stranger.id, { destinationUrl: 'https://elsewhere.example/', code: 'launch' }), error => error.getStatus() === 409);
  await shortener.update(owner.id, short.id, { code: 'launch' });
  assert.equal(await shortener.resolve('new-launch', request), tracked.href);
  await assert.rejects(shortener.stats(stranger.id, short.id), error => error.getStatus() === 404);
  await shortener.update(owner.id, short.id, { isActive: false });
  await assert.rejects(shortener.resolve(short.code, request), error => error.getStatus() === 404);
  await assert.rejects(shortener.resolve('new-launch', request), error => error.getStatus() === 404);

  // A busy account must not permanently occupy the first page of due jobs.
  config.set('SOCIAL_DM_MONTHLY_LIMIT', 1000);
  const busyRule = await db.dmAutomation.create({ data: { accountId: account.id, name: 'Busy', triggerType: 'ALL_POSTS', matchType: 'ANY',
    message: 'Busy', buttonLabel: 'Open', destinationUrl: 'https://example.com/' } });
  const deliveryData = index => ({ accountId: account.id, automationId: busyRule.id, commentId: String(10000 + index), mediaId: '987',
    commentCreatedAt: new Date(), message: 'Queued', buttonLabel: 'Open', destinationUrl: 'https://example.com/', clickToken: randomBytes(32).toString('base64url') });
  await db.dmDelivery.createMany({ data: Array.from({ length: 700 }, (_, index) => ({ ...deliveryData(index), status: 'SENT', claimedAt: new Date() })) });
  await db.dmDelivery.createMany({ data: Array.from({ length: 12 }, (_, index) => ({ ...deliveryData(1000 + index), createdAt: new Date(Date.now() - 1000) })) });
  const quietAccount = await db.socialAccount.create({ data: { userId: owner.id, platform: 'INSTAGRAM', externalId: '124', username: 'quiet',
    accessToken: vault.encrypt('test-token'), nextSyncAt: new Date('2099-01-01') } });
  const quietRule = await db.dmAutomation.create({ data: { accountId: quietAccount.id, name: 'Quiet', triggerType: 'ALL_POSTS', matchType: 'ANY',
    message: 'Quiet', buttonLabel: 'Open', destinationUrl: 'https://example.com/' } });
  const quietJob = await db.dmDelivery.create({ data: { ...deliveryData(2000), accountId: quietAccount.id, automationId: quietRule.id } });
  const exhausted = await db.socialCommentEvent.create({ data: { accountId: account.id, commentId: '99999', mediaId: '987',
    text: 'private comment', occurredAt: new Date(), status: 'PROCESSING', attempts: 5, claimedAt: new Date(Date.now() - 6 * 60_000) } });
  await service.tick(); await service.tick();
  assert.equal((await db.dmDelivery.findUnique({ where: { id: quietJob.id } })).status, 'SENT');
  assert.equal(sends, 3);
  const exhaustedResult = await db.socialCommentEvent.findUnique({ where: { id: exhausted.id } });
  assert.equal(exhaustedResult.status, 'FAILED');
  assert.equal(exhaustedResult.text, '');
  assert.equal(await db.dmDelivery.count({ where: { automationId: busyRule.id, status: 'PENDING', errorCode: 'HOURLY_LIMIT', nextAttemptAt: { gt: new Date() } } }), 12);
  await service.deleteInstagramData('124');
  const confirmation = await service.deleteInstagramData('123');
  assert.equal(service.deletionStatus(confirmation).data.status, 'complete');
  assert.equal(await db.socialAccount.count(), 0);
  assert.equal(await db.dmDelivery.count(), 0);
});
