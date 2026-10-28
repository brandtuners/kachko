const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { PagesService } = require('../dist/modules/pages/pages.service');
const { AnalyticsService } = require('../dist/modules/analytics/analytics.service');
const { AnalyticsQueryController } = require('../dist/modules/analytics/analytics.controller');
const { ClerkWebhookController } = require('../dist/modules/identity/clerk-webhook.controller');
const { createHmac } = require('node:crypto');
const { subscriptionHasAccess } = require('../dist/modules/identity/clerk-identity.service');

test('cancellation preserves paid access until period end', () => {
  assert.equal(subscriptionHasAccess({ status: 'active', periodEnd: null }, 1000), true);
  assert.equal(subscriptionHasAccess({ status: 'canceled', periodEnd: 2000 }, 1000), true);
  assert.equal(subscriptionHasAccess({ status: 'canceled', periodEnd: 1000 }, 1000), false);
  for (const status of ['ended', 'upcoming', 'incomplete', 'past_due']) {
    assert.equal(subscriptionHasAccess({ status, periodEnd: 2000 }, 1000), false);
  }
});

const id = 'd6f0b953-461d-43b7-8e16-dbd98c10c1a1';
function linkService(features, content) {
  return new PagesService({ publicLink: async () => ({ id, content: { title: 'Launch', url: 'https://example.com', ...content },
    page: { user: { billingFeatures: features } } }) }, {}, new ConfigService({}));
}

test('smart routing matches first rule, falls back, and disables on downgrade', async () => {
  const content = { smartRouting: { rules: [
    { condition: 'country', value: 'IN', destinationUrl: 'https://india.example.com' },
    { condition: 'device', value: 'mobile', destinationUrl: 'https://mobile.example.com' },
  ] } };
  const request = { headers: { 'x-vercel-ip-country': 'in', 'user-agent': 'iPhone' } };
  assert.equal(await linkService(['smart_routing'], content).resolvePublicLink(id, request), 'https://india.example.com/');
  assert.equal(await linkService(['smart_routing'], content).resolvePublicLink(id, { headers: { 'user-agent': 'iPhone' } }), 'https://mobile.example.com/');
  assert.equal(await linkService(['smart_routing'], content).resolvePublicLink(id, { headers: {} }), 'https://example.com/');
  assert.equal(await linkService([], content).resolvePublicLink(id, request), 'https://example.com/');
});

test('routing uses original source hostname with exact subdomain boundaries', async () => {
  const service = linkService(['smart_routing'], { smartRouting: { rules: [
    { condition: 'referrer', value: 'instagram.com', destinationUrl: 'https://social.example.com' },
  ] } });
  const request = source => ({ headers: { referer: 'https://kachko.example/creator' }, query: { source } });
  assert.equal(await service.resolvePublicLink(id, request('https://www.instagram.com/post')), 'https://social.example.com/');
  assert.equal(await service.resolvePublicLink(id, request('https://evilinstagram.com')), 'https://example.com/');
  assert.equal(await service.resolvePublicLink(id, request('javascript:alert(1)')), 'https://example.com/');
});

test('scheduled links enforce start/end on direct resolver requests; downgrade disables schedule', async () => {
  for (const automation of [{ activeFrom: '2099-01-01T00:00:00.000Z' }, { activeUntil: '2000-01-01T00:00:00.000Z' }]) {
    await assert.rejects(linkService(['automations'], { automation }).resolvePublicLink(id, { headers: {} }), error => error.getStatus() === 404);
    assert.equal(await linkService([], { automation }).resolvePublicLink(id, { headers: {} }), 'https://example.com/');
  }
});

test('extended analytics history and CSV export require an entitlement', async () => {
  const controller = new AnalyticsQueryController({ summary: async () => ({ ok: true }), exportCsv: async () => Buffer.from('csv') });
  const free = { identity: { id: 'owner' }, entitlements: { features: [] } };
  const paid = { ...free, entitlements: { features: ['advanced_analytics'] } };
  assert.deepEqual(await controller.summary(free, id, { range: '30d' }), { ok: true });
  assert.throws(() => controller.summary(free, id, { range: '365d' }), error => error.getStatus() === 403);
  assert.deepEqual(await controller.summary(paid, id, { range: '365d' }), { ok: true });
  await assert.rejects(controller.exportCsv(free, id, { range: '7d' }, {}), error => error.getStatus() === 403);
});

test('all-time series includes today even when first event was later in its UTC day', async () => {
  const first = new Date(); first.setUTCHours(23, 59, 59, 0);
  const service = new AnalyticsService({ ownedPage: async () => true, firstEvent: async () => ({ createdAt: first }),
    timeseries: async () => [] }, new ConfigService({}));
  const result = await service.timeseries('owner', id, { range: 'all' });
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].date, new Date().toISOString().slice(0, 10));
});

test('analytics CSV omits network identifiers, escapes formulas and enforces page ownership', async () => {
  let owned = true;
  const service = new AnalyticsService({ ownedPage: async () => owned, exportEvents: async () => [{
    createdAt: new Date(), eventType: 'LINK_CLICK', block: { content: { title: '=HYPERLINK("https://evil.example")' } },
    ipHash: 'private-value', country: 'IN', referrer: 'https://instagram.com',
  }] }, new ConfigService({}));
  const csv = (await service.exportCsv('owner', id, { range: '7d' })).toString();
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('""https://evil.example""'));
  assert.ok(!csv.includes('private-value'));
  owned = false;
  await assert.rejects(service.exportCsv('foreign', id, { range: '7d' }), error => error.getStatus() === 404);
});

test('Clerk webhook rejects forged signatures and reconciles verified subscription events', async () => {
  const key = Buffer.from('test-signing-secret-for-webhooks');
  const config = new ConfigService({ CLERK_WEBHOOK_SIGNING_SECRET: `whsec_${key.toString('base64')}` });
  const users = [];
  const controller = new ClerkWebhookController({ syncBilling: async userId => users.push(userId) }, config);
  const rawBody = Buffer.from(JSON.stringify({ type: 'subscriptionItem.active', data: { payer: { user_id: 'user_test' } } }));
  const messageId = 'msg_test'; const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', key).update(`${messageId}.${timestamp}.${rawBody}`).digest('base64');
  const request = { rawBody, headers: { 'svix-id': messageId, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` },
    protocol: 'https', get: () => 'api.example.com', originalUrl: '/api/v1/webhooks/clerk' };
  await controller.receive(request);
  assert.deepEqual(users, ['user_test']);
  request.headers['svix-signature'] = 'v1,forged';
  await assert.rejects(controller.receive(request), error => error.getStatus() === 400);
  assert.equal(users.length, 1);
});
