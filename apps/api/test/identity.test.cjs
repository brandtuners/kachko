const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerSchema, profileSchema, usernameSchema, passwordResetRequestSchema, passwordResetConfirmSchema,
  createReportSchema, deleteAccountSchema } = require('@kachko/validation');
const { validateEnvironment } = require('../dist/config/environment');
const { CsrfGuard, sessionCookie } = require('../dist/modules/identity/identity.guards');
const { ConfigService } = require('@nestjs/config');

test('shared identity contracts normalize names, protect fields and bound inputs', () => {
  const valid = { email: ' User@Example.com ', password: 'long-password-123', username: ' Rohan.Dev ' };
  assert.equal(registerSchema.parse(valid).username, 'rohan.dev');
  assert.equal(registerSchema.parse(valid).email, 'user@example.com');
  for (const username of ['ad', 'a'.repeat(31), 'admin', 'API', 'name/name', 'name name', 'ééé']) {
    assert.equal(registerSchema.safeParse({ ...valid, username }).success, false);
  }
  assert.equal(usernameSchema.parse('ADMIN'), 'admin');
  for (const body of [{}, { role: 'ADMIN' }, { bio: 'x'.repeat(501) }, { username: null }, { avatarUrl: 'https://example.com/a.png' }]) {
    assert.equal(profileSchema.safeParse(body).success, false);
  }
  assert.deepEqual(profileSchema.parse({ bio: null, displayName: null }), { bio: null, displayName: null });
});

test('launch protection contracts reject unsafe reset, report and deletion inputs', () => {
  assert.equal(passwordResetRequestSchema.parse({ email: ' User@Example.com ' }).email, 'user@example.com');
  assert.equal(passwordResetConfirmSchema.safeParse({ token: 'x'.repeat(32), password: 'long-password-123' }).success, true);
  assert.equal(passwordResetConfirmSchema.safeParse({ token: 'short', password: 'long-password-123' }).success, false);
  assert.equal(createReportSchema.safeParse({ pageId: 'not-an-id', reason: 'SPAM' }).success, false);
  assert.equal(createReportSchema.safeParse({ pageId: '123e4567-e89b-42d3-a456-426614174000', reason: 'OTHER', details: 'too short' }).success, false);
  assert.deepEqual(deleteAccountSchema.parse({ confirmation: 'DELETE' }), { confirmation: 'DELETE' });
  assert.equal(deleteAccountSchema.safeParse({ confirmation: 'delete' }).success, false);
});

test('cookie parsing and CSRF reject ambiguous credentials and unsafe browser mutations', () => {
  const config = new ConfigService({ SESSION_COOKIE_NAME: 'kachko_session', CORS_ORIGINS: ['http://localhost:3000'] });
  const token = 'a'.repeat(43);
  const cookie = `kachko_session=${token}`;
  assert.equal(sessionCookie({ headers: { cookie } }, config), token);
  assert.equal(sessionCookie({ headers: { cookie: `${cookie}; ${cookie}` } }, config), undefined);
  assert.equal(sessionCookie({ headers: { cookie: 'kachko_session=bad' } }, config), undefined);
  const guard = new CsrfGuard(config, { getAllAndOverride: () => false });
  const context = (method, headers) => ({ getHandler: () => null, getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }) });
  assert.equal(guard.canActivate(context('GET', {})), true);
  assert.throws(() => guard.canActivate(context('POST', {})));
  assert.throws(() => guard.canActivate(context('PATCH', { 'x-kachko-csrf': '1', origin: 'null' })));
  assert.equal(guard.canActivate(context('POST', { 'x-kachko-csrf': '1', origin: 'http://localhost:3000' })), true);
  assert.equal(guard.canActivate(context('POST', { 'x-kachko-csrf': '1' })), true);
});

test('session configuration is bounded and typed', () => {
  const env = { DATABASE_URL: 'postgresql://test:test@localhost/test', REDIS_URL: 'redis://localhost:6379' };
  assert.equal(validateEnvironment(env).SESSION_TTL_SECONDS, 604800);
  assert.equal(validateEnvironment({ ...env, SESSION_TTL_SECONDS: '60' }).SESSION_TTL_SECONDS, 60);
  for (const value of ['0', 'NaN', '2592001']) assert.throws(() => validateEnvironment({ ...env, SESSION_TTL_SECONDS: value }));
  assert.throws(() => validateEnvironment({ ...env, SESSION_COOKIE_NAME: 'bad;name' }));
});
