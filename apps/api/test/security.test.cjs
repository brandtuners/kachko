const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { hash } = require('@node-rs/argon2');
const { IdentityService } = require('../dist/modules/identity/identity.service');
const { clerkSessionToken } = require('../dist/modules/identity/identity.guards');

test('malformed percent-encoded Clerk cookies fail closed without throwing', () => {
  for (const value of ['%', '%GG', '%E0%A4%A']) {
    assert.equal(clerkSessionToken({ headers: { cookie: `__session=${value}` } }), undefined);
  }
  assert.equal(clerkSessionToken({ headers: { cookie: '__session=one; __session=two' } }), undefined);
  assert.equal(clerkSessionToken({ headers: { authorization: 'Bearer signed-token' } }), 'signed-token');
});

test('Clerk-managed users cannot authenticate through legacy passwords, sessions, or Google grants', async () => {
  const user = { id: 'owner', clerkUserId: 'user_clerk', isActive: true, deletedAt: null,
    passwordHash: await hash('old-password-123') };
  const repository = {
    findByEmail: async () => user,
    findSession: async () => ({ user, expiresAt: new Date(Date.now() + 60_000), revokedAt: null }),
    findGoogle: async () => ({ user, userId: user.id }),
    createSession: () => assert.fail('A legacy session must not be issued for a Clerk identity'),
    touchSession: () => assert.fail('A legacy session must not be accepted for a Clerk identity'),
  };
  const service = new IdentityService(repository, new ConfigService({ SESSION_TTL_SECONDS: 600 }), {});
  for (const attempt of [
    () => service.login({ email: 'owner@example.test', password: 'old-password-123' }),
    () => service.authenticate('legacy-session'),
    () => service.googleLogin('old-google-subject'),
  ]) await assert.rejects(attempt(), error => error.getStatus() === 401);
});
