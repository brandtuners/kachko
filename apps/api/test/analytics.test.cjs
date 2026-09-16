const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { analyticsEventSchema, analyticsRangeSchema } = require('@kachko/validation');
const { AnalyticsService } = require('../dist/modules/analytics/analytics.service');

test('analytics event and date-range contracts reject ambiguous targets', () => {
  const pageId = '20da19cc-7e63-4aa9-8cc0-7d68c26acbd2';
  const blockId = '3e0df075-67e2-46f6-a4e8-cafefd7a47c8';
  assert.equal(analyticsEventSchema.safeParse({ pageId, eventType: 'PAGE_VIEW' }).success, true);
  assert.equal(analyticsEventSchema.safeParse({ pageId, blockId, eventType: 'PAGE_VIEW' }).success, false);
  assert.equal(analyticsEventSchema.safeParse({ pageId, eventType: 'LINK_CLICK' }).success, false);
  assert.equal(analyticsEventSchema.safeParse({ pageId, socialProfileId: blockId, eventType: 'SOCIAL_CLICK' }).success, true);
  assert.equal(analyticsEventSchema.safeParse({ pageId, blockId, socialProfileId: blockId, eventType: 'SOCIAL_CLICK' }).success, false);
  assert.equal(analyticsEventSchema.safeParse({ pageId, blockId, eventType: 'LINK_CLICK', country: 'US' }).success, false);
  assert.deepEqual(analyticsRangeSchema.parse({}), { range: '7d' });
  assert.equal(analyticsRangeSchema.safeParse({ range: '365d' }).success, false);
});

test('analytics hashes network identity and computes bounded owner metrics', async () => {
  const stored = [];
  const repository = {
    target: async () => ({}),
    create: async (pageId, target, eventType, metadata) => { stored.push({ pageId, target, eventType, metadata }); },
    ownedPage: async () => true,
    counts: async () => [
      { eventType: 'PAGE_VIEW', _count: { _all: 4 } },
      { eventType: 'LINK_CLICK', _count: { _all: 1 } },
      { eventType: 'SOCIAL_CLICK', _count: { _all: 2 } },
    ],
    uniqueVisitors: async () => 3,
  };
  const service = new AnalyticsService(repository, new ConfigService({ ANALYTICS_HASH_SALT: 'a'.repeat(32) }));
  const pageId = '20da19cc-7e63-4aa9-8cc0-7d68c26acbd2';
  const request = { headers: {
    'x-forwarded-for': '203.0.113.9', 'user-agent': 'Mozilla/5.0 (iPhone) Safari/605.1',
    referer: 'https://search.example/results?q=private', 'x-vercel-ip-country': 'in', 'x-vercel-ip-city': 'New%20Delhi',
  }, socket: {} };
  assert.deepEqual(await service.ingest({ pageId, eventType: 'PAGE_VIEW' }, request), { data: { accepted: true } });
  assert.equal(stored.length, 1);
  assert.equal(stored[0].metadata.ipHash.length, 64);
  assert.notEqual(stored[0].metadata.ipHash, '203.0.113.9');
  assert.equal(stored[0].metadata.referrer, 'https://search.example');
  assert.equal(stored[0].metadata.country, 'IN');
  assert.equal(stored[0].metadata.city, 'New Delhi');
  assert.equal(stored[0].metadata.device, 'mobile');

  const result = await service.summary('owner', pageId, { range: '7d' });
  assert.equal(result.data.totalViews, 4);
  assert.equal(result.data.uniqueVisitors, 3);
  assert.equal(result.data.linkClicks, 1);
  assert.equal(result.data.socialClicks, 2);
  assert.equal(result.data.clickThroughRate, 25);
});

test('analytics rejects events for non-public or mismatched targets', async () => {
  const service = new AnalyticsService({ target: async () => null }, new ConfigService({ ANALYTICS_HASH_SALT: 'a'.repeat(32) }));
  await assert.rejects(
    service.ingest({ pageId: '20da19cc-7e63-4aa9-8cc0-7d68c26acbd2', eventType: 'PAGE_VIEW' }, { headers: {}, socket: {} }),
    error => error.getStatus() === 404 && error.getResponse().code === 'ANALYTICS_TARGET_NOT_FOUND',
  );
});
