const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerSchema, profileSchema, usernameSchema } = require('@kachko/validation');
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
