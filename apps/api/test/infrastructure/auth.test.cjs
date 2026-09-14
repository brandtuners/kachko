const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { randomUUID, createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
require('reflect-metadata');
const exec = promisify(execFile);
const docker = async (...args) => (await exec('docker', args, { timeout: 120000 })).stdout.trim();

// Uses isolated, temporary containers; never mutates the developer's services/data.
test('identity journey, persistence, ownership, CSRF, revocation and distributed limits', { timeout: 180000 }, async t => {
  const suffix = randomUUID().slice(0, 8);
  const postgres = `kachko-auth-pg-${suffix}`;
  const redis = `kachko-auth-redis-${suffix}`;
  const created = [];
  let app;
  t.after(async () => {
    try { if (app) await app.close(); }
    finally { await Promise.all(created.map(name => docker('rm', '--force', '--volumes', name))); }
  });
  await docker('run', '-d', '--name', postgres, '--tmpfs', '/var/lib/postgresql/data',
    '-e', 'POSTGRES_USER=kachko', '-e', 'POSTGRES_PASSWORD=test_only', '-e', 'POSTGRES_DB=kachko_auth_test',
    '-p', '127.0.0.1::5432', 'postgres:16-alpine');
  created.push(postgres);
  await docker('run', '-d', '--name', redis, '--tmpfs', '/data', '-p', '127.0.0.1::6379', 'redis:7-alpine');
  created.push(redis);
  const pgPort = (await docker('port', postgres, '5432/tcp')).split(':').at(-1);
  const redisPort = (await docker('port', redis, '6379/tcp')).split(':').at(-1);
  process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-only-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:4000/api/v1/auth/google/callback';
  process.env.GOOGLE_LOGIN_REDIRECT_URL = '';
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `postgresql://kachko:test_only@127.0.0.1:${pgPort}/kachko_auth_test`;
  process.env.REDIS_URL = `redis://127.0.0.1:${redisPort}`;
  process.env.CORS_ORIGINS = 'http://localhost:3000';
  process.env.DEPENDENCY_TIMEOUT_MS = '1000';
  process.env.SESSION_TTL_SECONDS = '604800';
  process.env.SESSION_COOKIE_NAME = 'kachko_session';
  for (let i = 0; i < 40; i++) {
    try { await docker('exec', postgres, 'pg_isready', '-U', 'kachko', '-d', 'kachko_auth_test'); break; }
    catch { await delay(250); }
  }
  await exec('pnpm', ['-w', 'db:deploy'], { env: process.env, timeout: 120000 });
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../../dist/app.module');
  const { configureApp } = require('../../dist/configure-app');
  const { PrismaService } = require('../../dist/database/prisma.service');
  const { RedisService } = require('../../dist/redis/redis.service');
  const start = async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    for (let i = 0; !app.get(RedisService).client.isReady && i < 40; i++) await delay(50);
  };
  await start();
  const req = async (path, { method = 'GET', body, cookie, headers = {}, csrf = true } = {}) => {
    const response = await fetch(`${await app.getUrl()}/api/v1${path}`, {
      method, redirect: 'manual', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(csrf ? { 'X-Kachko-CSRF': '1' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(6000),
    });
    return { status: response.status, headers: response.headers, body: response.status === 302 ? null : await response.json() };
  };
  const flushLimits = () => app.get(RedisService).client.flushDb();
  const registration = { email: ' Rohan@Example.com ', username: ' Rohan ', password: 'test-password-123', displayName: 'Rohan' };
  const register = body => req('/auth/register', { method: 'POST', body });
  assert.equal((await req('/auth/register', { method: 'POST', body: registration, csrf: false })).status, 403);
  assert.equal((await req('/auth/register', { method: 'POST', body: registration, headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await register({ ...registration, username: 'ADMIN' })).status, 400);
  assert.equal((await register({ ...registration, role: 'ADMIN' })).status, 400);
  assert.equal((await register({ ...registration, password: 'short' })).status, 400);
  await flushLimits();
  const registered = await register(registration);
  assert.equal(registered.status, 201);
  assert.equal(registered.body.data.email, 'rohan@example.com');
  assert.equal(registered.body.data.username, 'rohan');
  assert.deepEqual(Object.keys(registered.body.data).sort(), ['avatarUrl', 'bio', 'displayName', 'email', 'id', 'username']);
  const setCookie = registered.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\/api\/v1/);
  assert.match(setCookie, /Max-Age=604800/);
  const cookie = setCookie.split(';')[0];
  const token = cookie.split('=')[1];
  let db = app.get(PrismaService);
  const stored = await db.user.findUnique({ where: { email: 'rohan@example.com' }, include: { sessions: true } });
  assert.match(stored.passwordHash, /^\$argon2id\$/);
  assert.equal(stored.sessions.length, 1);
  assert.equal(stored.sessions[0].tokenHash, createHash('sha256').update(token).digest('hex'));
  assert.notEqual(stored.sessions[0].tokenHash, token);
  assert.equal((await req('/auth/me')).status, 401);
  assert.equal((await req('/auth/me', { cookie })).status, 200);
  assert.equal((await req('/users/me', { cookie })).headers.get('cache-control'), 'no-store');
  assert.equal((await req('/users/username/ADMIN')).body.data.reason, 'reserved');
  assert.equal((await req('/users/username/Rohan')).body.data.reason, 'taken');
  assert.equal((await req('/users/username/free_name')).body.data.available, true);
  assert.equal((await req('/users/username/!!')).status, 400);
  assert.equal((await register(registration)).status, 409);
  assert.equal(await db.user.count(), 1);
  assert.equal(await db.session.count(), 1);
  const other = await register({ ...registration, email: 'girish@example.com', username: 'girish' });
  assert.equal(other.status, 201);
  assert.equal((await req('/users/me', { method: 'PATCH', cookie, body: { id: other.body.data.id, bio: 'bad' } })).status, 400);
  assert.equal((await req('/users/me', { method: 'PATCH', cookie, body: { username: 'girish' } })).status, 409);
  assert.equal((await req('/users/me', { method: 'PATCH', cookie, body: { avatarUrl: 'https://evil.example/a.png' } })).status, 400);
  assert.equal((await req('/users/me', { method: 'PATCH', cookie, body: {}, csrf: false })).status, 403);
  const updated = await req('/users/me', { method: 'PATCH', cookie, body: { username: ' Rohan.Dev ', displayName: 'Rohan Dev', bio: 'Building kachko' } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.username, 'rohan.dev');
  assert.equal((await db.user.findUnique({ where: { id: other.body.data.id } })).bio, null);
  // Verify sessions survive API restart (not process-local state).
  await app.close();
  app = undefined;
  await start();
  db = app.get(PrismaService);
  assert.equal((await req('/auth/me', { cookie })).body.data.bio, 'Building kachko');
  const wrong = await req('/auth/login', { method: 'POST', body: { email: registration.email, password: 'incorrect' } });
  const unknown = await req('/auth/login', { method: 'POST', body: { email: 'unknown@example.com', password: 'incorrect' } });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.body, unknown.body);
  const loggedIn = await req('/auth/login', { method: 'POST', cookie, body: { email: registration.email, password: registration.password } });
  assert.equal(loggedIn.status, 200);
  const newCookie = loggedIn.headers.get('set-cookie').split(';')[0];
  assert.notEqual(newCookie, cookie);
  assert.equal((await req('/auth/me', { cookie })).status, 401, 'old session revoked on login');
  assert.equal((await req('/auth/me', { cookie: newCookie })).status, 200);
  const logout = await req('/auth/logout', { method: 'POST', cookie: newCookie });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
  assert.equal((await req('/auth/me', { cookie: newCookie })).status, 401);
  const fresh = await req('/auth/login', { method: 'POST', body: { email: registration.email, password: registration.password } });
  const freshCookie = fresh.headers.get('set-cookie').split(';')[0];
  await db.session.updateMany({ where: { userId: stored.id }, data: { expiresAt: new Date(0) } });
  assert.equal((await req('/auth/me', { cookie: freshCookie })).status, 401);
  await db.session.updateMany({ where: { userId: stored.id }, data: { expiresAt: new Date(Date.now() + 60000) } });
  for (const data of [{ isActive: false }, { isActive: true, deletedAt: new Date() }]) {
    await db.user.update({ where: { id: stored.id }, data });
    assert.equal((await req('/auth/me', { cookie: freshCookie })).status, 401);
  }
  await db.user.update({ where: { id: stored.id }, data: { isActive: true, deletedAt: null } });
  await flushLimits();
  // Concurrent duplicate registrations leave only one user and one matching session.
  const concurrent = await Promise.all([1, 2].map(() => register({ ...registration, email: 'race@example.com', username: 'race' })));
  assert.deepEqual(concurrent.map(r => r.status).sort(), [201, 409]);
  assert.equal(await db.user.count({ where: { email: 'race@example.com' } }), 1);
  await flushLimits();
  for (let i = 0; i < 5; i++) assert.equal((await req('/auth/login', { method: 'POST', body: { email: 'missing@example.com', password: 'incorrect' } })).status, 401);
  const limited = await req('/auth/login', { method: 'POST', headers: { 'X-Forwarded-For': '1.2.3.4' }, body: { email: 'missing@example.com', password: 'incorrect' } });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  await flushLimits();
  for (let i = 0; i < 3; i++) assert.equal((await register({})).status, 400);
  assert.equal((await register({})).status, 429);
  await flushLimits();
  // Only the Google token exchange is stubbed; DB, Redis, HTTP and sessions are real.
  const { GoogleProvider } = require('../../dist/modules/identity/google.provider');
  let exchanges = 0;
  app.get(GoogleProvider).exchange = async (code, verifier, nonce) => {
    exchanges++;
    assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
    assert.match(nonce, /^[A-Za-z0-9_-]{43}$/);
    if (code === 'collision') return { subject: 'google-collision', email: 'rohan@example.com' };
    return { subject: 'google-subject-1', email: 'google@example.com' };
  };
  const extractCookie = (result, name) => result.headers.getSetCookie().find(v => v.startsWith(`${name}=`)).split(';')[0];
  const beginGoogle = async () => {
    const result = await req('/auth/google');
    assert.equal(result.status, 302);
    const url = new URL(result.headers.get('location'));
    assert.equal(url.origin, 'https://accounts.google.com');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.match(url.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
    assert.equal(url.searchParams.get('redirect_uri'), process.env.GOOGLE_REDIRECT_URI);
    return { state: url.searchParams.get('state'), cookie: extractCookie(result, 'kachko_google_state') };
  };
  const callback = (flow, code = 'new-google') => req(`/auth/google/callback?state=${flow.state}&code=${code}`, { cookie: flow.cookie });
  let flow = await beginGoogle();
  assert.equal((await req(`/auth/google/callback?state=${flow.state}&code=new-google`)).status, 403);
  assert.equal(exchanges, 0);
  const onboarding = await callback(flow);
  assert.equal(onboarding.status, 200);
  assert.equal(onboarding.body.data.onboardingRequired, true);
  assert.equal((await callback(flow)).status, 403, 'state is single-use');
  const pendingCookie = extractCookie(onboarding, 'kachko_google_pending');
  assert.equal((await req('/auth/google/pending', { cookie: pendingCookie })).body.data.email, 'google@example.com');
  assert.equal(await db.user.count({ where: { email: 'google@example.com' } }), 0, 'no account before username selection');
  assert.equal((await req('/auth/me', { cookie: pendingCookie })).status, 401);
  assert.equal((await req('/auth/google/complete', { method: 'POST', cookie: pendingCookie, csrf: false, body: { username: 'google_user' } })).status, 403);
  assert.equal((await req('/auth/google/complete', { method: 'POST', cookie: pendingCookie, body: { username: 'admin' } })).status, 400);
  const completed = await req('/auth/google/complete', { method: 'POST', cookie: pendingCookie, body: { username: 'google_user', displayName: 'Google User' } });
  assert.equal(completed.status, 201);
  const googleCookie = extractCookie(completed, 'kachko_session');
  assert.equal((await req('/auth/me', { cookie: googleCookie })).body.data.username, 'google_user');
  const googleAccount = await db.googleAccount.findUnique({ where: { subject: 'google-subject-1' }, include: { user: true } });
  assert.equal(googleAccount.user.passwordHash, null);
  assert.equal(googleAccount.user.isVerified, true);
  assert.equal((await req('/auth/google/complete', { method: 'POST', cookie: pendingCookie, body: { username: 'google_user_again' } })).status, 401);
  assert.equal((await req('/auth/google/pending', { cookie: pendingCookie })).status, 401);
  flow = await beginGoogle();
  const returning = await callback(flow);
  assert.equal(returning.body.data.onboardingRequired, false);
  assert.equal(returning.body.data.user.id, googleAccount.userId);
  assert.equal(await db.googleAccount.count(), 1);
  const returningCookie = extractCookie(returning, 'kachko_session');
  assert.equal((await req('/auth/logout', { method: 'POST', cookie: returningCookie })).status, 200);
  assert.equal((await req('/auth/me', { cookie: returningCookie })).status, 401);
  flow = await beginGoogle();
  const collision = await callback(flow, 'collision');
  assert.equal(collision.status, 409);
  assert.equal(collision.body.error.code, 'ACCOUNT_LINK_REQUIRED');
  assert.equal(await db.googleAccount.count(), 1, 'no automatic email linking');
  flow = await beginGoogle();
  assert.equal((await req(`/auth/google/callback?state=${flow.state}&error=access_denied`, { cookie: flow.cookie })).status, 401);
  assert.equal((await callback(flow)).status, 403);
  flow = await beginGoogle();
  await app.get(RedisService).client.del(`google:state:${createHash('sha256').update(flow.state).digest('hex')}`);
  assert.equal((await callback(flow)).status, 403, 'expired state is rejected');
  await db.user.update({ where: { id: googleAccount.userId }, data: { isActive: false } });
  flow = await beginGoogle();
  assert.equal((await callback(flow)).status, 401, 'disabled Google users cannot login');
  await docker('stop', redis);
  const unavailable = await req('/auth/login', { method: 'POST', body: { email: registration.email, password: registration.password } });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.error.code, 'DEPENDENCIES_UNAVAILABLE');
});
