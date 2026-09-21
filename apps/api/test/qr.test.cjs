const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PagesService } = require('../dist/modules/pages/pages.service');

test('QR generation encodes the canonical public URL as a PNG', async () => {
  const service = new PagesService(
    { get: async () => ({ slug: 'rohan', isPrimary: true, userId: 'user-1', user: { username: 'rohan' }, blocks: [], socials: [] }) },
    {},
    { getOrThrow: () => 'https://kachko.app/' },
  );
  const result = await service.qr('user-1', 'page-1');
  assert.equal(result.data.url, 'https://kachko.app/rohan');
  assert.equal(result.data.png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});

test('QR generation includes the slug for an additional page', async () => {
  const service = new PagesService(
    { get: async () => ({ slug: 'portfolio', isPrimary: false, userId: 'user-1', user: { username: 'rohan' }, blocks: [], socials: [] }) },
    {},
    { getOrThrow: () => 'https://kachko.app' },
  );
  const result = await service.qr('user-1', 'page-2');
  assert.equal(result.data.url, 'https://kachko.app/rohan/portfolio');
});

test('QR generation hides foreign or missing pages', async () => {
  const service = new PagesService({ get: async () => null }, {}, { getOrThrow: () => 'https://kachko.app' });
  await assert.rejects(service.qr('other-user', 'page-1'), error => error.getStatus() === 404 && error.getResponse()?.code === 'PAGE_NOT_FOUND');
});
