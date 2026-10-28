const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { shortLinkDestination, createShortLinkSchema, updateShortLinkSchema } = require('@kachko/validation');
const { SocialService } = require('../dist/modules/social/social.service');
const { SocialController } = require('../dist/modules/social/social.controller');
const config = new ConfigService({ NODE_ENV: 'test', PUBLIC_APP_URL: 'https://kachko.example', SOCIAL_DM_MONTHLY_LIMIT: 1000 });
const service = db => new SocialService(db, {}, config, {}, {}, {});

test('campaign UTMs preserve other parameters/fragments and replace only explicitly configured values', () => {
  const url = new URL(shortLinkDestination('https://example.com/shop?coupon=sale&utm_source=existing#buy', { medium: 'social', campaign: 'Summer sale' }));
  assert.equal(url.searchParams.get('coupon'), 'sale');
  assert.equal(url.searchParams.get('utm_source'), 'existing');
  assert.equal(url.searchParams.get('utm_medium'), 'social');
  assert.equal(url.searchParams.get('utm_campaign'), 'Summer sale');
  assert.equal(url.hash, '#buy');
  const replacement = new URL(shortLinkDestination(url.href, { source: 'instagram' }));
  assert.deepEqual(replacement.searchParams.getAll('utm_source'), ['instagram']);
  assert.equal(createShortLinkSchema.safeParse({ destinationUrl: 'https://example.com', utm: { source: 'x\nHeader' } }).success, false);
  assert.equal(createShortLinkSchema.safeParse({ destinationUrl: 'https://example.com', utm: { unsupported: 'x' } }).success, false);
  assert.deepEqual(updateShortLinkSchema.parse({ utm: {} }), { utm: {} });
});

test('hidden subscriber totals do not hide independently available video counts', async () => {
  const db = { socialAccount: { findFirst: async () => ({ id: 'account', report: {} }) },
    socialSnapshot: { findMany: async () => [{ date: new Date(), followers: null, posts: 12, views: null, reach: null }] },
    socialMedia: { findMany: async () => [] } };
  const result = await service(db).analytics('owner', 'account', '30d');
  assert.equal(result.data.followers, null);
  assert.equal(result.data.posts, 12);
});

test('free media picker does not bypass paid social performance metrics', async () => {
  const db = { socialAccount: { findFirst: async () => ({ id: 'account' }) }, socialMedia: { findMany: async () => [{
    externalId: '123', caption: 'Post', permalink: 'https://example.com', mediaType: 'IMAGE', publishedAt: new Date(), likes: 40, comments: 4, views: 100n,
  }] } };
  const controller = new SocialController(service(db), config);
  const free = { identity: { id: 'owner' }, entitlements: { features: [] } };
  const freeResult = await controller.media(free, 'account');
  assert.equal(freeResult.data[0].caption, 'Post');
  assert.equal(freeResult.data[0].likes, null);
  assert.equal(freeResult.data[0].views, null);
  assert.equal((await controller.media({ ...free, entitlements: { features: ['advanced_analytics'] } }, 'account')).data[0].views, 100);
});

function failedDelivery(status = 'FAILED') {
  return { id: 'delivery', accountId: 'account', status, commentCreatedAt: new Date(),
    automation: { isActive: true, accountId: 'account', deletedAt: null }, account: { status: 'CONNECTED', user: {
      isActive: true, deletedAt: null, billingFeatures: ['automations'] } } };
}
test('manual retry is one atomic requeue of a confirmed failure and never resends uncertain or sent replies', async () => {
  let item = failedDelivery(); let updates = 0;
  const tx = { dmDelivery: { findFirst: async () => item, updateMany: async () => {
    updates++; item = { ...item, status: 'PENDING' }; return { count: 1 };
  } } };
  const subject = service({ $transaction: callback => callback(tx) });
  assert.equal((await subject.retryDelivery('owner', 'delivery')).data.queued, true);
  for (const status of ['SENT', 'SENDING', 'UNKNOWN', 'PENDING', 'SKIPPED']) {
    item = failedDelivery(status);
    await assert.rejects(subject.retryDelivery('owner', 'delivery'), error => error.getStatus() === 409);
  }
  assert.equal(updates, 1);
  item = null;
  await assert.rejects(subject.retryDelivery('stranger', 'delivery'), error => error.getStatus() === 404);
});

test('manual retries enforce the paid plan, current automation state, and comment window', async () => {
  for (const change of [item => { item.account.user.billingFeatures = []; }, item => { item.automation.isActive = false; },
    item => { item.account.status = 'RECONNECT_REQUIRED'; }, item => { item.commentCreatedAt = new Date('2000-01-01'); }]) {
    const item = failedDelivery(); change(item);
    const subject = service({ $transaction: callback => callback({ dmDelivery: { findFirst: async () => item,
      updateMany: () => assert.fail('Ineligible reply must not be requeued') } }) });
    await assert.rejects(subject.retryDelivery('owner', 'delivery'), error => [403, 409].includes(error.getStatus()));
  }
});

test('delivery history excludes message contents, click tokens, and foreign automation cursors', async () => {
  const row = { id: 'delivery', status: 'UNKNOWN', errorCode: 'SEND_UNCONFIRMED', clickToken: 'secret-token', message: 'private message',
    createdAt: new Date(), nextAttemptAt: new Date(), sentAt: null, clickCount: 1, commentCreatedAt: new Date() };
  const db = { dmAutomation: { findFirst: async () => ({ id: 'automation' }) }, dmDelivery: {
    findMany: async () => [row], findFirst: async () => null } };
  const result = await service(db).deliveries('owner', 'automation');
  assert.equal(result.data.items[0].canRetry, false);
  assert.ok(!JSON.stringify(result).includes('secret-token'));
  assert.ok(!JSON.stringify(result).includes('private message'));
  await assert.rejects(service(db).deliveries('owner', 'automation', 'foreign-cursor'), error => error.getStatus() === 400);
});

test('hourly-limited replies are deferred without a send, freeing the due queue for other accounts', async () => {
  const item = { ...failedDelivery('PENDING'), account: { ...failedDelivery().account, id: 'account' } };
  const writes = []; let counts = 0;
  const tx = { $queryRaw: async () => [], dmDelivery: { findUnique: async () => item,
    count: async () => ++counts === 1 ? 800 : 700,
    update: async ({ data }) => { writes.push(data); return item; } } };
  const subject = service({ $transaction: callback => callback(tx) });
  const now = Date.now();
  await subject.sendDelivery('delivery');
  assert.equal(writes[0].errorCode, 'HOURLY_LIMIT');
  assert.ok(writes[0].nextAttemptAt.getTime() >= now + 299_000);
  assert.ok(!writes.some(write => write.status === 'SENDING'));
});
