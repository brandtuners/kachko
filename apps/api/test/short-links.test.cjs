const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { createShortLinkSchema, updateShortLinkSchema, shortLinkCodeSchema } = require('@kachko/validation');
const { ShortLinksService } = require('../dist/modules/short-links/short-links.service');
const { ShortLinksRepository } = require('../dist/modules/short-links/short-links.repository');

const config = new ConfigService({ PUBLIC_APP_URL: 'https://kachko.example' });
const stored = overrides => ({ id: '6aa7e550-dba9-46d7-93fb-deb47ae3fb2c', userId: 'owner', code: 'summer', title: null,
  destinationUrl: 'https://destination.example/', channel: null, tags: [], isActive: true, clickCount: 0,
  createdAt: new Date(), updatedAt: new Date(), ...overrides });

test('short-link contracts allow campaigns and reject unsafe destinations, invalid aliases and empty edits', () => {
  assert.equal(createShortLinkSchema.parse({ destinationUrl: 'HTTPS://Example.com' }).destinationUrl, 'https://example.com/');
  assert.equal(createShortLinkSchema.safeParse({ destinationUrl: 'javascript:alert(1)' }).success, false);
  assert.equal(createShortLinkSchema.safeParse({ destinationUrl: 'https://user:pass@example.com' }).success, false);
  assert.equal(createShortLinkSchema.safeParse({ destinationUrl: 'https://example.com', userId: 'another-owner' }).success, false);
  assert.equal(createShortLinkSchema.safeParse({ destinationUrl: 'https://example.com', tags: Array(21).fill('x') }).success, false);
  assert.equal(updateShortLinkSchema.safeParse({}).success, false);
  assert.equal(updateShortLinkSchema.safeParse({ code: 'new-code', isActive: false }).success, true);
  for (const code of ['a', '../foo', 'with space', 'a'.repeat(49)]) assert.equal(shortLinkCodeSchema.safeParse(code).success, false);
});

test('short-link allocation retries cryptographic codes and reports custom-code collisions', async () => {
  const codes = []; let attempts = 0;
  const repo = { create: async (owner, code, data) => { codes.push(code); if (++attempts === 1) throw { code: 'P2002' }; return stored({ code, ...data }); } };
  const service = new ShortLinksService(repo, config);
  const result = await service.create('owner', { destinationUrl: 'https://destination.example/' });
  assert.equal(codes.length, 2);
  assert.notEqual(codes[0], codes[1]);
  assert.match(result.data.shortUrl, /^https:\/\/kachko\.example\/s\/[A-Za-z0-9_-]{12}$/);
  const taken = new ShortLinksService({ create: async () => { throw { code: 'P2002' }; } }, config);
  await assert.rejects(taken.create('owner', { destinationUrl: 'https://destination.example/', code: 'taken' }),
    error => error.getStatus() === 409 && error.getResponse().code === 'SHORT_CODE_UNAVAILABLE');
});

test('short-link destinations reject self-referential shortener chains', async () => {
  const service = new ShortLinksService({}, config);
  await assert.rejects(service.create('owner', { destinationUrl: 'https://kachko.example/s/existing' }),
    error => error.getStatus() === 400 && error.getResponse().code === 'SHORT_LINK_LOOP');
});

test('short-link edits and analytics conceal missing or foreign resources', async () => {
  const service = new ShortLinksService({ update: async () => null, owned: async () => null }, config);
  await assert.rejects(service.update('foreign', 'id', { isActive: false }), error => error.getStatus() === 404);
  await assert.rejects(service.stats('foreign', 'id'), error => error.getStatus() === 404);
  await assert.rejects(service.list('foreign', 'cursor'), error => error.getStatus() === 400);
});

test('short-link redirect records only bounded source/device/country metadata', async () => {
  let captured;
  const service = new ShortLinksService({ resolve: async (code, metadata) => { captured = { code, ...metadata }; return 'https://destination.example/'; } }, config);
  const result = await service.resolve('summer', { headers: { 'user-agent': 'Mozilla iPhone', 'cf-ipcountry': 'in',
    referer: 'https://instagram.com/somewhere?private=value' }, ip: '203.0.113.1' });
  assert.equal(result, 'https://destination.example/');
  assert.deepEqual(captured, { code: 'summer', device: 'mobile', referrer: 'https://instagram.com', country: 'IN' });
  const unavailable = new ShortLinksService({ resolve: async () => null }, config);
  await assert.rejects(unavailable.resolve('missing', { headers: {} }), error => error.getStatus() === 404);
});

test('short-link resolver excludes inactive links and suspended owners before recording clicks', async () => {
  let criteria;
  const tx = { shortLink: { findFirst: async input => { criteria = input.where; return null; } },
    shortLinkClick: { create: async () => assert.fail('Unavailable links cannot record clicks') } };
  const repo = new ShortLinksRepository({ $transaction: async callback => callback(tx) });
  assert.equal(await repo.resolve('disabled', { device: 'desktop', referrer: null, country: null }), null);
  assert.deepEqual(criteria, { OR: [{ code: 'disabled' }, { aliases: { some: { code: 'disabled' } } }],
    isActive: true, user: { isActive: true, deletedAt: null } });
});

test('short-link repository scopes updates to owner before reading updated values', async () => {
  const tx = { shortLink: { updateMany: async input => { assert.deepEqual(input.where, { id: 'id', userId: 'owner' }); return { count: 0 }; },
    findUnique: async () => assert.fail('Foreign resources must not be read') } };
  const repo = new ShortLinksRepository({ $transaction: async callback => callback(tx) });
  assert.equal(await repo.update('owner', 'id', { isActive: false }), null);
});

test('short-link history is paginated without leaking private owner IDs', async () => {
  const rows = Array.from({ length: 51 }, (_, index) => stored({ id: `link-${index}` }));
  const service = new ShortLinksService({ list: async () => rows }, config);
  const result = await service.list('owner');
  assert.equal(result.data.items.length, 50);
  assert.equal(result.data.nextCursor, 'link-49');
  assert.equal('userId' in result.data.items[0], false);
});
