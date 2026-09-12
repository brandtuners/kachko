const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../../dist/generated/prisma/client');

// Never fall back to DATABASE_URL: require an explicit disposable local test DB.
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error('Set TEST_DATABASE_URL to a migrated local database ending in _test.');
const url = new URL(connectionString);
if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^\/[a-zA-Z0-9_]+_test$/.test(url.pathname) || url.search || url.hash) {
  throw new Error('TEST_DATABASE_URL must target a local PostgreSQL *_test database without query overrides.');
}

test('User/Session migration enforces identity constraints through Prisma', async (t) => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const suffix = randomUUID().replaceAll('-', '').slice(0, 20);
  const email = `identity-${suffix}@example.test`;
  const username = `user_${suffix}`;
  const userIds = [];
  t.after(async () => {
    try { await prisma.user.deleteMany({ where: { id: { in: userIds } } }); }
    finally { await prisma.$disconnect(); }
  });
  const user = await prisma.user.create({ data: { email, username } });
  userIds.push(user.id);
  assert.equal(user.role, 'USER');
  assert.equal(user.isActive, true);
  assert.equal(user.isVerified, false);
  assert.equal(user.passwordHash, null);
  assert.equal(user.deletedAt, null);
  assert.ok(user.createdAt instanceof Date);
  assert.ok(user.updatedAt instanceof Date);
  await assert.rejects(prisma.user.create({ data: { email, username: `dup_${suffix}` } }), { code: 'P2002' });
  await assert.rejects(prisma.user.create({ data: { email: `dup-${email}`, username } }), { code: 'P2002' });

  const tokenHash = createHash('sha256').update(randomUUID()).digest('hex');
  const expiresAt = new Date(Date.now() + 3600000);
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash, expiresAt } });
  assert.equal(session.tokenHash, tokenHash);
  assert.equal(session.expiresAt.getTime(), expiresAt.getTime());
  assert.equal(session.revokedAt, null);
  assert.equal(session.lastUsedAt, null);
  assert.equal('token' in session, false);
  await assert.rejects(prisma.session.create({ data: { userId: user.id, tokenHash, expiresAt } }), { code: 'P2002' });
  await assert.rejects(prisma.session.create({ data: { userId: randomUUID(), tokenHash: `other-${tokenHash}`, expiresAt } }), { code: 'P2003' });
  const revokedAt = new Date();
  const revoked = await prisma.session.update({ where: { id: session.id }, data: { revokedAt, lastUsedAt: revokedAt } });
  assert.equal(revoked.revokedAt.getTime(), revokedAt.getTime());
  assert.equal(revoked.lastUsedAt.getTime(), revokedAt.getTime());
  const loaded = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { sessions: true } });
  assert.equal(loaded.sessions.length, 1);
  await prisma.user.delete({ where: { id: user.id } });
  assert.equal(await prisma.session.count({ where: { userId: user.id } }), 0);
});
