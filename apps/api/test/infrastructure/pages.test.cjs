const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../../dist/generated/prisma/client');
const { IdentityRepository } = require('../../dist/modules/identity/identity.repository');
const exec = promisify(execFile);
const docker = async (...args) => (await exec('docker', args, { timeout: 120000 })).stdout.trim();

test('page migration enforces single-page ownership and cascades; username changes are atomic', { timeout: 120000 }, async t => {
  const name = `kachko-pages-${randomUUID().slice(0, 8)}`;
  let created = false;
  let db;
  let app;
  let redisCreated = false;
  const redisName = `${name}-redis`;
  t.after(async () => {
    try { if (app) await app.close(); if (db) await db.$disconnect(); }
    finally {
      if (created) await docker('rm', '--force', '--volumes', name);
      if (redisCreated) await docker('rm', '--force', '--volumes', redisName);
    }
  });
  await docker('run', '-d', '--name', name, '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_USER=kachko',
    '-e', 'POSTGRES_PASSWORD=test_only', '-e', 'POSTGRES_DB=kachko_pages_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine');
  created = true;
  const port = (await docker('port', name, '5432/tcp')).split(':').at(-1);
  const connectionString = `postgresql://kachko:test_only@127.0.0.1:${port}/kachko_pages_test`;
  for (let i = 0; i < 40; i++) {
    try { await docker('exec', name, 'pg_isready', '-U', 'kachko', '-d', 'kachko_pages_test'); break; }
    catch { await delay(250); }
  }
  const env = { ...process.env, DATABASE_URL: connectionString };
  await exec('pnpm', ['-w', 'db:deploy'], { env, timeout: 60000 });
  await exec('pnpm', ['-w', 'db:deploy'], { env, timeout: 60000 });
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const owner = await db.user.create({ data: { email: 'owner@example.test', username: 'owner' } });
  const other = await db.user.create({ data: { email: 'other@example.test', username: 'other' } });
  const page = await db.page.create({ data: { userId: owner.id, slug: owner.username } });
  assert.equal(page.isPublished, false);
  assert.equal(page.publishedAt, null);
  assert.equal(page.themeKey, 'minimal');
  await assert.rejects(db.page.create({ data: { userId: owner.id, slug: 'second' } }), { code: 'P2002' });
  await assert.rejects(db.page.create({ data: { userId: other.id, slug: owner.username } }), { code: 'P2002' });
  await assert.rejects(db.page.create({ data: { userId: randomUUID(), slug: 'missing' } }), { code: 'P2003' });
  const block = await db.pageBlock.create({ data: { pageId: page.id, type: 'LINK', position: 0,
    content: { title: 'Site', url: 'https://example.com/', openInNewTab: true } } });
  assert.equal(block.isVisible, true);
  assert.equal(block.content.title, 'Site');
  await assert.rejects(db.pageBlock.create({ data: { pageId: page.id, type: 'LINK', position: -1, content: {} } }));
  await assert.rejects(db.pageBlock.create({ data: { pageId: randomUUID(), type: 'LINK', position: 0, content: {} } }), { code: 'P2003' });
  const repository = new IdentityRepository(db);
  await repository.updateProfile(owner.id, { username: 'renamed', bio: 'new bio' });
  assert.equal((await db.page.findUnique({ where: { id: page.id } })).slug, 'renamed');
  assert.equal((await db.user.findUnique({ where: { id: owner.id } })).username, 'renamed');
  // A conflicting page slug must roll back the User mutation as well.
  const otherPage = await db.page.create({ data: { userId: other.id, slug: 'occupied' } });
  await assert.rejects(repository.updateProfile(owner.id, { username: 'occupied', bio: 'must roll back' }), { code: 'P2002' });
  const unchanged = await db.user.findUnique({ where: { id: owner.id } });
  assert.equal(unchanged.username, 'renamed');
  assert.equal(unchanged.bio, 'new bio');
  assert.equal((await db.page.findUnique({ where: { id: page.id } })).slug, 'renamed');
  await db.page.delete({ where: { id: page.id } });
  assert.equal(await db.pageBlock.count({ where: { id: block.id } }), 0);
  assert.ok(await db.user.findUnique({ where: { id: owner.id } }));
  await db.pageBlock.create({ data: { pageId: otherPage.id, type: 'LINK', position: 0, content: {} } });
  await db.user.delete({ where: { id: other.id } });
  assert.equal(await db.page.count({ where: { id: otherPage.id } }), 0);
  assert.equal(await db.pageBlock.count({ where: { pageId: otherPage.id } }), 0);

  // Full HTTP journey with real sessions, Redis cache and PostgreSQL.
  await docker('run', '-d', '--name', redisName, '--tmpfs', '/data', '-p', '127.0.0.1::6379', 'redis:7-alpine');
  redisCreated = true;
  const redisPort = (await docker('port', redisName, '6379/tcp')).split(':').at(-1);
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: connectionString,
    REDIS_URL: `redis://127.0.0.1:${redisPort}`, CORS_ORIGINS: 'http://localhost:3000,http://localhost:4000',
    DEPENDENCY_TIMEOUT_MS: '1000', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', SESSION_COOKIE_NAME: 'kachko_session' });
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../../dist/app.module');
  const { configureApp } = require('../../dist/configure-app');
  const { RedisService } = require('../../dist/redis/redis.service');
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const redisClient = app.get(RedisService).client;
  for (let i = 0; !redisClient.isReady && i < 40; i++) await delay(50);
  const request = async (path, { method = 'GET', body, cookie, csrf = true } = {}) => {
    const res = await fetch(`${base}/api/v1${path}`, { method, headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-Kachko-CSRF': '1' } : {}),
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(6000) });
    return { status: res.status, body: await res.json(), headers: res.headers };
  };
  const register = async username => {
    const res = await request('/auth/register', { method: 'POST', body: { username, email: `${username}@example.test`, password: 'test-password-123' } });
    assert.equal(res.status, 201);
    return { cookie: res.headers.get('set-cookie').split(';')[0], id: res.body.data.id };
  };
  const alice = await register('page_alice');
  const bob = await register('page_bob');
  assert.equal((await request('/pages')).status, 401);
  assert.equal((await request('/pages', { cookie: alice.cookie })).body.data.length, 0);
  assert.equal((await request('/pages', { method: 'POST', cookie: alice.cookie, body: {}, csrf: false })).status, 403);
  assert.equal((await request('/pages', { method: 'POST', cookie: alice.cookie, body: { userId: bob.id } })).status, 400);
  // Concurrent creates are serialized with the owner lock; only one succeeds.
  const createdPages = await Promise.all([1, 2].map(() => request('/pages', { method: 'POST', cookie: alice.cookie, body: { title: 'Alice links' } })));
  assert.deepEqual(createdPages.map(r => r.status).sort(), [201, 409]);
  const alicePage = createdPages.find(r => r.status === 201).body.data;
  const root = `/pages/${alicePage.id}`;
  assert.equal(alicePage.slug, 'page_alice');
  assert.equal(alicePage.themeKey, 'minimal');
  assert.equal(alicePage.isPublished, false);
  assert.equal(alicePage.userId, undefined);
  assert.equal(alicePage.revision, undefined);
  assert.equal((await request('/public/page_alice')).status, 404);
  for (const [method, path, body] of [['GET', root], ['PATCH', root, { title: 'attack' }], ['DELETE', root],
    ['POST', `${root}/publish`], ['POST', `${root}/unpublish`], ['POST', `${root}/blocks`, { type: 'LINK', content: { title: 'attack', url: 'https://example.com' } }]]) {
    assert.equal((await request(path, { method, body, cookie: bob.cookie })).status, 404, `${method} foreign ${path}`);
  }
  assert.equal((await request('/pages/not-a-uuid', { cookie: alice.cookie })).status, 400);
  assert.equal((await request(root, { method: 'PATCH', cookie: alice.cookie, body: { isPublished: true } })).status, 400);
  assert.equal((await request(`${root}/blocks`, { method: 'POST', cookie: alice.cookie, body: { type: 'LINK', content: { title: 'bad', url: 'javascript:alert(1)' } } })).status, 400);
  const links = await Promise.all([1, 2, 3].map(i => request(`${root}/blocks`, { method: 'POST', cookie: alice.cookie,
    body: { type: 'LINK', content: { title: `Link ${i}`, url: 'HTTPS://Example.COM' }, isVisible: i !== 3 } })));
  assert.ok(links.every(r => r.status === 201));
  assert.deepEqual(links.map(r => r.body.data.position).sort(), [0, 1, 2]);
  assert.equal(links[0].body.data.content.url, 'https://example.com/');
  assert.equal(links[0].body.data.content.openInNewTab, true);
  const first = links[0].body.data.id;
  assert.equal((await request(root, { cookie: alice.cookie })).body.data.blocks.length, 3);
  for (const method of ['PATCH', 'DELETE']) assert.equal((await request(`${root}/blocks/${first}`, { method, cookie: bob.cookie,
    ...(method === 'PATCH' ? { body: { isVisible: false } } : {}) })).status, 404);
  const bobPage = (await request('/pages', { method: 'POST', cookie: bob.cookie, body: {} })).body.data;
  assert.equal((await request(`/pages/${bobPage.id}/blocks/${first}`, { method: 'PATCH', cookie: bob.cookie, body: { isVisible: false } })).body.error.code, 'BLOCK_NOT_FOUND');
  const published = await request(`${root}/publish`, { method: 'POST', cookie: alice.cookie });
  assert.equal(published.status, 200);
  const timestamp = published.body.data.publishedAt;
  assert.ok(timestamp);
  assert.equal((await request(`${root}/publish`, { method: 'POST', cookie: alice.cookie })).body.data.publishedAt, timestamp);
  let publicPage = await request('/public/page_alice');
  assert.equal(publicPage.status, 200);
  assert.equal(publicPage.headers.get('cache-control'), 'no-store');
  assert.equal(publicPage.body.data.blocks.length, 2);
  assert.deepEqual(Object.keys(publicPage.body.data.profile).sort(), ['avatarUrl', 'bio', 'displayName', 'username']);
  assert.deepEqual(Object.keys(publicPage.body.data.blocks[0]).sort(), ['content', 'id', 'type']);
  const persisted = await db.page.findUnique({ where: { id: alicePage.id } });
  const oldKey = `page:page_alice:${persisted.id}:${persisted.revision}`;
  assert.ok(await redisClient.get(oldKey), 'public response cached');
  await request(`${root}/blocks/${first}`, { method: 'PATCH', cookie: alice.cookie, body: { content: { title: 'Changed title', url: 'https://changed.example/' } } });
  publicPage = await request('/public/page_alice');
  assert.equal(publicPage.body.data.blocks.find(b => b.id === first).content.title, 'Changed title');
  await request(`${root}/blocks/${first}`, { method: 'PATCH', cookie: alice.cookie, body: { isVisible: false } });
  assert.equal((await request('/public/page_alice')).body.data.blocks.length, 1);
  await request(root, { method: 'PATCH', cookie: alice.cookie, body: { title: 'New page title' } });
  assert.equal((await request('/public/page_alice')).body.data.page.title, 'New page title');
  await request('/users/me', { method: 'PATCH', cookie: alice.cookie, body: { bio: 'Updated bio' } });
  assert.equal((await request('/public/page_alice')).body.data.profile.bio, 'Updated bio');
  await request('/users/me', { method: 'PATCH', cookie: alice.cookie, body: { username: 'page_alice_new' } });
  assert.equal((await request('/public/page_alice')).status, 404);
  assert.equal((await request('/public/page_alice_new')).status, 200);
  await request(`${root}/unpublish`, { method: 'POST', cookie: alice.cookie });
  assert.equal((await request('/public/page_alice_new')).status, 404);
  assert.equal((await request(root, { cookie: alice.cookie })).body.data.publishedAt, null);
  await request(`${root}/publish`, { method: 'POST', cookie: alice.cookie });
  assert.equal((await request('/public/page_alice_new')).status, 200);
  // DB moderation gates override even warm Redis responses.
  await db.user.update({ where: { id: alice.id }, data: { isActive: false } });
  assert.equal((await request('/public/page_alice_new')).status, 404);
  await db.user.update({ where: { id: alice.id }, data: { isActive: true, deletedAt: new Date() } });
  assert.equal((await request('/public/page_alice_new')).status, 404);
  await db.user.update({ where: { id: alice.id }, data: { deletedAt: null } });
  await request(`${root}/blocks/${first}`, { method: 'DELETE', cookie: alice.cookie });
  const remaining = (await request(root, { cookie: alice.cookie })).body.data.blocks;
  assert.deepEqual(remaining.map(b => b.position), [0, 1]);
  const visible = remaining.find(b => b.isVisible);
  await request(`${root}/blocks/${visible.id}`, { method: 'DELETE', cookie: alice.cookie });
  assert.equal((await request('/public/page_alice_new')).body.data.blocks.length, 0);
  const swagger = await (await fetch(`${base}/api/docs-json`)).json();
  for (const path of ['/api/v1/pages', '/api/v1/pages/{id}', '/api/v1/pages/{id}/publish', '/api/v1/pages/{id}/unpublish',
    '/api/v1/pages/{pageId}/blocks', '/api/v1/pages/{pageId}/blocks/{blockId}', '/api/v1/public/{username}']) assert.ok(swagger.paths[path], path);
  assert.ok(swagger.paths['/api/v1/pages'].post.requestBody.content['application/json'].schema);
  await request(root, { method: 'DELETE', cookie: alice.cookie });
  assert.equal((await request('/public/page_alice_new')).status, 404);
  assert.equal(await db.pageBlock.count({ where: { pageId: alicePage.id } }), 0);
  // Create and rename serialize on User; the final slug must equal the username.
  const race = await Promise.all([
    request('/pages', { method: 'POST', cookie: alice.cookie, body: {} }),
    request('/users/me', { method: 'PATCH', cookie: alice.cookie, body: { username: 'page_race' } }),
  ]);
  assert.deepEqual(race.map(r => r.status), [201, 200]);
  const lastPage = await db.page.findUnique({ where: { userId: alice.id } });
  assert.equal(lastPage.slug, 'page_race');
  await request(`/pages/${lastPage.id}/publish`, { method: 'POST', cookie: alice.cookie });
  assert.equal((await request('/public/page_race')).status, 200);
  await docker('stop', redisName);
  assert.equal((await request('/public/page_race')).status, 200, 'public reads fall back to PostgreSQL');
  await db.page.update({ where: { id: lastPage.id }, data: { isPublished: false } });
  assert.equal((await request('/public/page_race')).status, 404, 'Redis outage cannot expose unpublished pages');
});
