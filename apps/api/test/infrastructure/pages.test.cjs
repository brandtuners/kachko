const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { access, mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
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
  const mediaDir = await mkdtemp(join(tmpdir(), 'kachko-media-test-'));
  const redisName = `${name}-redis`;
  t.after(async () => {
    try { if (app) await app.close(); if (db) await db.$disconnect(); }
    finally {
      await rm(mediaDir, { recursive: true, force: true });
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
    DEPENDENCY_TIMEOUT_MS: '1000', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', SESSION_COOKIE_NAME: 'kachko_session',
    MEDIA_STORAGE: 'local', MEDIA_LOCAL_DIR: mediaDir });
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
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const uploadImage = async (cookie, forAvatar = false) => {
    const authorized = await request('/media/upload-url', { method: 'POST', cookie, body: { mimeType: 'image/png', size: png.length, forAvatar } });
    assert.equal(authorized.status, 201);
    const target = authorized.body.data;
    const put = await fetch(`${base}${target.uploadUrl}`, { method: 'PUT', headers: { ...target.headers, Cookie: cookie }, body: png });
    assert.equal(put.status, 204);
    const completed = await request('/media/complete', { method: 'POST', cookie, body: { storageKey: target.storageKey, width: 1, height: 1, forAvatar } });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.data.mimeType, 'image/png');
    assert.equal(completed.body.data.size, png.length);
    return { ...completed.body.data, storageKey: target.storageKey };
  };
  const image = await uploadImage(alice.cookie);
  const replacedAvatar = await uploadImage(alice.cookie, true);
  const avatar = await uploadImage(alice.cookie, true);
  assert.equal((await request('/users/me', { cookie: alice.cookie })).body.data.avatarUrl, avatar.url);
  assert.equal((await request(`/media/${replacedAvatar.id}`, { cookie: alice.cookie })).status, 404);
  await assert.rejects(access(join(mediaDir, replacedAvatar.storageKey)));
  const removedAvatar = await request('/media/avatar', { method: 'DELETE', cookie: alice.cookie });
  assert.equal(removedAvatar.status, 200);
  assert.deepEqual(removedAvatar.body.data, { cleared: true, deleted: true });
  assert.equal((await request('/users/me', { cookie: alice.cookie })).body.data.avatarUrl, null);
  assert.equal((await request(`/media/${avatar.id}`, { cookie: alice.cookie })).status, 404);
  await assert.rejects(access(join(mediaDir, avatar.storageKey)));
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
  assert.equal((await request(`${root}/blocks`, { method: 'POST', cookie: bob.cookie,
    body: { type: 'IMAGE', content: { mediaId: image.id, alt: 'stolen' } } })).status, 404);
  for (const [type, content] of Object.entries({
    IMAGE: { mediaId: image.id, alt: 'Photo' },
    SOCIAL: { platform: 'GITHUB', username: 'rohan' }, DIVIDER: {},
    YOUTUBE: { videoId: 'dQw4w9WgXcQ' },
    SPOTIFY: { url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC' },
    EMAIL: { email: 'hello@example.com' }, PHONE: { number: '+91 9876543210' }, LOCATION: { query: 'Mumbai' },
  })) {
    const created = await request(`${root}/blocks`, { method: 'POST', cookie: alice.cookie, body: { type, content } });
    assert.equal(created.status, 201, type);
    const id = created.body.data.id;
    assert.equal(created.body.data.type, type);
    if (type === 'IMAGE') {
      assert.equal(created.body.data.content.url, image.url);
      const publicFile = await fetch(`${base}${image.url}`);
      assert.equal(publicFile.status, 200);
      assert.equal(publicFile.headers.get('content-type'), 'image/png');
      assert.deepEqual(Buffer.from(await publicFile.arrayBuffer()), png);
      assert.equal((await request(`/media/${image.id}`, { method: 'DELETE', cookie: alice.cookie })).status, 409);
    }
    const patched = await request(`${root}/blocks/${id}`, { method: 'PATCH', cookie: alice.cookie, body: { content } });
    assert.equal(patched.status, 200, type);
    const invalid = await request(`${root}/blocks/${id}`, { method: 'PATCH', cookie: alice.cookie, body: { content: { text: 'wrong type' } } });
    assert.equal(invalid.status, 400, type);
    assert.equal((await request(`${root}/blocks/${id}`, { method: 'DELETE', cookie: alice.cookie })).status, 200);
    if (type === 'IMAGE') assert.equal((await request(`/media/${image.id}`, { method: 'DELETE', cookie: alice.cookie })).status, 200);
  }
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
  // TEXT and reorder extension: current page is published and empty.
  await redisClient.flushDb(); // Isolated test Redis only; reset the preceding journey's limits.
  const editorRoot = `/pages/${lastPage.id}`;
  const add = body => request(`${editorRoot}/blocks`, { method: 'POST', cookie: alice.cookie, body });
  const textCreated = await add({ type: 'TEXT', content: { text: 'Hello\nworld' } });
  assert.equal(textCreated.status, 201);
  assert.equal(textCreated.body.data.content.alignment, 'left');
  const textId = textCreated.body.data.id;
  const linkCreated = await add({ type: 'LINK', content: { title: 'Website', url: 'https://example.com' } });
  assert.equal(linkCreated.status, 201);
  const linkId = linkCreated.body.data.id;
  const hiddenCreated = await add({ type: 'TEXT', content: { text: 'Hidden' }, isVisible: false });
  const hiddenId = hiddenCreated.body.data.id;
  const patch = (id, body) => request(`${editorRoot}/blocks/${id}`, { method: 'PATCH', cookie: alice.cookie, body });
  assert.equal((await patch(textId, { content: { title: 'wrong type', url: 'https://example.com' } })).status, 400);
  assert.equal((await patch(linkId, { content: { text: 'wrong type' } })).status, 400);
  assert.equal((await patch(textId, { type: 'LINK' })).status, 400);
  assert.equal((await add({ type: 'TEXT', content: { text: ' ' } })).status, 400);
  assert.equal((await add({ type: 'TEXT', content: { text: 'x'.repeat(5001) } })).status, 400);
  let mixed = await request('/public/page_race');
  assert.deepEqual(mixed.body.data.blocks.map(b => b.type), ['TEXT', 'LINK']);
  const edited = await patch(textId, { content: { text: '<b>Still plain text</b>', alignment: 'center' } });
  assert.equal(edited.status, 200);
  mixed = await request('/public/page_race');
  assert.equal(mixed.body.data.blocks[0].content.text, '<b>Still plain text</b>');
  assert.equal(mixed.body.data.blocks[0].content.alignment, 'center');
  const reorder = (items, cookie = alice.cookie, csrf = true) => request(`${editorRoot}/blocks/reorder`, { method: 'POST', cookie, csrf, body: { items } });
  const order = ids => ids.map((id, position) => ({ id, position }));
  const target = order([linkId, hiddenId, textId]);
  assert.equal((await reorder(target, alice.cookie, false)).status, 403);
  assert.equal((await reorder(target, bob.cookie)).status, 404);
  const beforeInvalid = await db.page.findUnique({ where: { id: lastPage.id }, include: { blocks: { orderBy: { position: 'asc' } } } });
  for (const [items, status] of [[[{ id: textId, position: 0 }, { id: textId, position: 1 }, { id: hiddenId, position: 2 }], 400],
    [order([textId, linkId]), 409], [order([textId, linkId, randomUUID()]), 409],
    [[{ id: textId, position: 0 }, { id: linkId, position: 2 }, { id: hiddenId, position: 3 }], 400], [[], 409]]) {
    assert.equal((await reorder(items)).status, status);
  }
  const afterInvalid = await db.page.findUnique({ where: { id: lastPage.id }, include: { blocks: { orderBy: { position: 'asc' } } } });
  assert.equal(afterInvalid.revision, beforeInvalid.revision);
  assert.deepEqual(afterInvalid.blocks.map(b => [b.id, b.position]), beforeInvalid.blocks.map(b => [b.id, b.position]));
  const reordered = await reorder(target);
  assert.equal(reordered.status, 200);
  assert.deepEqual(reordered.body.data.blocks.map(b => b.id), [linkId, hiddenId, textId]);
  assert.deepEqual((await request('/public/page_race')).body.data.blocks.map(b => b.id), [linkId, textId]);
  assert.equal((await patch(hiddenId, { isVisible: true })).status, 200);
  assert.deepEqual((await request('/public/page_race')).body.data.blocks.map(b => b.id), [linkId, hiddenId, textId]);
  // Concurrent content editing must not be overwritten by a reorder.
  const concurrentEdits = await Promise.all([reorder(order([textId, linkId, hiddenId])), patch(textId, { content: { text: 'Concurrent edit', alignment: 'right' } })]);
  assert.ok(concurrentEdits.every(r => r.status === 200));
  const afterConcurrent = (await request(editorRoot, { cookie: alice.cookie })).body.data.blocks;
  assert.deepEqual(afterConcurrent.map(b => b.id), [textId, linkId, hiddenId]);
  assert.equal(afterConcurrent[0].content.text, 'Concurrent edit');
  // A block-set change either follows a valid reorder, or makes that reorder stale.
  const raceAdd = await Promise.all([reorder(order([hiddenId, linkId, textId])), add({ type: 'TEXT', content: { text: 'Added concurrently' } })]);
  assert.ok([200, 409].includes(raceAdd[0].status));
  assert.equal(raceAdd[1].status, 201);
  const addedId = raceAdd[1].body.data.id;
  let editorBlocks = (await request(editorRoot, { cookie: alice.cookie })).body.data.blocks;
  assert.deepEqual(editorBlocks.map(b => b.position), [0, 1, 2, 3]);
  const raceDelete = await Promise.all([reorder(order(editorBlocks.map(b => b.id).reverse())),
    request(`${editorRoot}/blocks/${addedId}`, { method: 'DELETE', cookie: alice.cookie })]);
  assert.ok([200, 409].includes(raceDelete[0].status));
  assert.equal(raceDelete[1].status, 200);
  editorBlocks = (await request(editorRoot, { cookie: alice.cookie })).body.data.blocks;
  assert.deepEqual(editorBlocks.map(b => b.position), [0, 1, 2]);
  assert.equal(editorBlocks.some(b => b.id === addedId), false);
  assert.equal((await request(`${editorRoot}/blocks/${textId}`, { method: 'DELETE', cookie: alice.cookie })).status, 200);
  assert.equal((await request('/public/page_race')).body.data.blocks.some(b => b.id === textId), false);
  const updatedSwagger = await (await fetch(`${base}/api/docs-json`)).json();
  assert.ok(updatedSwagger.paths['/api/v1/pages/{pageId}/blocks/reorder'].post);
  const createSchema = updatedSwagger.paths['/api/v1/pages/{pageId}/blocks'].post.requestBody.content['application/json'].schema;
  assert.ok(JSON.stringify(createSchema).includes('TEXT'));
  // Empty page reorder is a valid no-op and remains owner-protected.
  assert.equal((await request(`/pages/${bobPage.id}/blocks/reorder`, { method: 'POST', cookie: bob.cookie, body: { items: [] } })).status, 200);
  // Appearance/social feature with fresh test limits and a warm public cache.
  await redisClient.flushDb();
  const themeCatalog = await request('/themes');
  assert.equal(themeCatalog.status, 200);
  assert.equal(themeCatalog.body.data.length, 11);
  for (const theme of themeCatalog.body.data) {
    const { themeConfigSchema } = require('@kachko/validation');
    assert.equal(themeConfigSchema.safeParse(theme.config).success, true);
    assert.equal((await request(`/themes/${theme.key}`)).status, 200);
  }
  assert.equal((await request('/themes/missing')).status, 404);
  const templateCatalog = await request('/templates');
  assert.equal(templateCatalog.body.data.length, 3);
  assert.equal((await request('/templates/creator')).status, 200);
  assert.equal((await request('/templates/missing')).status, 404);
  const ap = body => request(`${editorRoot}/appearance`, { method: 'PATCH', cookie: alice.cookie, body });
  assert.equal((await request(`${editorRoot}/appearance`, { cookie: bob.cookie })).status, 404);
  assert.equal((await request(`${editorRoot}/appearance`, { method: 'PATCH', cookie: bob.cookie, body: { themeKey: 'dark' } })).status, 404);
  assert.equal((await request(`${editorRoot}/appearance`, { method: 'PATCH', cookie: alice.cookie, csrf: false, body: { themeKey: 'dark' } })).status, 403);
  assert.equal((await ap({ themeKey: 'dark' })).status, 200);
  let appearance = (await request(`${editorRoot}/appearance`, { cookie: alice.cookie })).body.data;
  assert.equal(appearance.themeKey, 'dark');
  assert.equal(appearance.appearance.background.color, '#111827');
  assert.equal((await request('/public/page_race')).body.data.page.appearance.background.color, '#111827');
  assert.equal((await ap({ overrides: { buttons: { radius: 25 }, typography: { titleSize: 40 } } })).status, 200);
  assert.equal((await request('/public/page_race')).body.data.page.appearance.buttons.radius, 25);
  assert.equal((await request(editorRoot, { cookie: alice.cookie })).body.data.appearance.typography.titleSize, 40);
  for (const body of [{ themeKey: 'unknown' }, { overrides: { css: 'body{display:none}' } },
    { overrides: { background: { type: 'solid', color: 'url(https://evil.example)' } } },
    { overrides: { typography: { fontFamily: 'arbitrary-font' } } }, { overrides: { cards: { blur: 999 } } }]) {
    assert.equal((await ap(body)).status, 400);
  }
  assert.equal((await ap({ themeKey: 'nature' })).status, 200);
  appearance = (await request(`${editorRoot}/appearance`, { cookie: alice.cookie })).body.data;
  assert.deepEqual(appearance.overrides, {});
  assert.equal(appearance.appearance.buttons.radius, 16);
  const addSocial = body => request(`${editorRoot}/socials`, { method: 'POST', cookie: alice.cookie, body });
  const socialCreated = await Promise.all([
    addSocial({ platform: 'GITHUB', url: 'HTTPS://GITHUB.COM/rohan', username: ' rohan ' }),
    addSocial({ platform: 'YOUTUBE', url: 'https://www.youtube.com/@rohan' }),
    addSocial({ platform: 'INSTAGRAM', url: 'https://instagram.com/rohan', isVisible: false }),
  ]);
  assert.ok(socialCreated.every(r => r.status === 201));
  assert.deepEqual(socialCreated.map(r => r.body.data.position).sort(), [0, 1, 2]);
  const githubSocial = socialCreated[0].body.data;
  const youtubeSocial = socialCreated[1].body.data;
  const instagramSocial = socialCreated[2].body.data;
  assert.equal(githubSocial.url, 'https://github.com/rohan');
  assert.equal(githubSocial.username, 'rohan');
  for (const body of [{ platform: 'GITHUB', url: 'javascript:alert(1)' }, { platform: 'GITHUB', url: 'https://github.com.evil.example/rohan' },
    { platform: 'GITHUB', url: 'https://user:pass@github.com/rohan' }, { platform: 'GITHUB', url: 'https://instagram.com/rohan' },
    { platform: 'GITHUB', url: 'https://github.com/rohan', position: 99 }]) assert.equal((await addSocial(body)).status, 400);
  let publicSocials = (await request('/public/page_race')).body.data.socials;
  assert.equal(publicSocials.length, 2);
  assert.deepEqual(Object.keys(publicSocials[0]).sort(), ['id', 'platform', 'url', 'username']);
  for (const method of ['PATCH', 'DELETE']) assert.equal((await request(`${editorRoot}/socials/${githubSocial.id}`, { method, cookie: bob.cookie,
    ...(method === 'PATCH' ? { body: { isVisible: false } } : {}) })).status, 404);
  assert.equal((await request(`${editorRoot}/socials`, { cookie: bob.cookie })).status, 404);
  const patchSocial = (id, body) => request(`${editorRoot}/socials/${id}`, { method: 'PATCH', cookie: alice.cookie, body });
  assert.equal((await patchSocial(githubSocial.id, { platform: 'X' })).status, 400);
  assert.equal((await patchSocial(githubSocial.id, { platform: 'X', url: 'https://x.com/rohan', username: null })).status, 200);
  assert.equal((await request('/public/page_race')).body.data.socials.find(s => s.id === githubSocial.id).platform, 'X');
  const socialOrder = [instagramSocial.id, youtubeSocial.id, githubSocial.id];
  const reorderSocial = items => request(`${editorRoot}/socials/reorder`, { method: 'POST', cookie: alice.cookie, body: { items } });
  const revisionBefore = (await db.page.findUnique({ where: { id: lastPage.id } })).revision;
  assert.equal((await reorderSocial(order(socialOrder.slice(0, 2)))).status, 409);
  assert.equal((await reorderSocial([{ id: socialOrder[0], position: 0 }, { id: socialOrder[0], position: 1 }, { id: socialOrder[2], position: 2 }])).status, 400);
  assert.equal((await db.page.findUnique({ where: { id: lastPage.id } })).revision, revisionBefore);
  assert.equal((await reorderSocial(order(socialOrder))).status, 200);
  assert.deepEqual((await request('/public/page_race')).body.data.socials.map(s => s.id), [youtubeSocial.id, githubSocial.id]);
  await patchSocial(instagramSocial.id, { isVisible: true });
  assert.deepEqual((await request('/public/page_race')).body.data.socials.map(s => s.id), socialOrder);
  const socialRace = await Promise.all([reorderSocial(order(socialOrder.slice().reverse())), addSocial({ platform: 'DISCORD', url: 'https://discord.gg/example' })]);
  assert.ok([200, 409].includes(socialRace[0].status));
  assert.equal(socialRace[1].status, 201);
  let ownerSocials = (await request(`${editorRoot}/socials`, { cookie: alice.cookie })).body.data;
  assert.deepEqual(ownerSocials.map(s => s.position), [0, 1, 2, 3]);
  assert.equal((await request(`${editorRoot}/socials/${socialRace[1].body.data.id}`, { method: 'DELETE', cookie: alice.cookie })).status, 200);
  ownerSocials = (await request(`${editorRoot}/socials`, { cookie: alice.cookie })).body.data;
  assert.deepEqual(ownerSocials.map(s => s.position), [0, 1, 2]);
  const templateBefore = await db.page.findUnique({ where: { id: lastPage.id }, include: { blocks: true } });
  const apply = body => request(`${editorRoot}/template`, { method: 'POST', cookie: alice.cookie, body });
  const noConfirm = await apply({ templateKey: 'creator' });
  assert.equal(noConfirm.status, 409);
  assert.equal(noConfirm.body.error.code, 'TEMPLATE_REPLACE_REQUIRED');
  assert.equal((await db.page.findUnique({ where: { id: lastPage.id } })).revision, templateBefore.revision);
  assert.equal((await request(`${editorRoot}/template`, { method: 'POST', cookie: bob.cookie, body: { templateKey: 'creator', replaceExistingBlocks: true } })).status, 404);
  const applied = await apply({ templateKey: 'creator', replaceExistingBlocks: true });
  assert.equal(applied.status, 200);
  assert.equal(applied.body.data.themeKey, 'gradient');
  assert.equal(applied.body.data.blocks.length, 3);
  assert.equal(applied.body.data.socials.length, 3);
  assert.ok(applied.body.data.blocks.every(b => !templateBefore.blocks.some(old => old.id === b.id)));
  assert.deepEqual(applied.body.data.appearanceOverrides, {});
  assert.equal((await request('/public/page_race')).body.data.page.appearance.background.type, 'gradient');
  assert.equal((await request('/public/page_race')).body.data.blocks.length, 3);
  // Template creation is atomic with the existing one-page constraint.
  await request(`/pages/${bobPage.id}`, { method: 'DELETE', cookie: bob.cookie });
  const fromTemplate = await request('/pages', { method: 'POST', cookie: bob.cookie, body: { templateKey: 'professional', title: 'My portfolio' } });
  assert.equal(fromTemplate.status, 201);
  assert.equal(fromTemplate.body.data.themeKey, 'professional');
  assert.equal(fromTemplate.body.data.blocks.length, 2);
  assert.equal(fromTemplate.body.data.isPublished, false);
  const checkSwagger = await (await fetch(`${base}/api/docs-json`)).json();
  for (const path of ['/api/v1/themes', '/api/v1/templates', '/api/v1/pages/{pageId}/appearance', '/api/v1/pages/{pageId}/template',
    '/api/v1/pages/{pageId}/socials', '/api/v1/pages/{pageId}/socials/{socialId}', '/api/v1/pages/{pageId}/socials/reorder']) assert.ok(checkSwagger.paths[path], path);
  await docker('stop', redisName);
  assert.equal((await request('/public/page_race')).status, 200, 'public reads fall back to PostgreSQL');
  await db.page.update({ where: { id: lastPage.id }, data: { isPublished: false } });
  assert.equal((await request('/public/page_race')).status, 404, 'Redis outage cannot expose unpublished pages');
});
