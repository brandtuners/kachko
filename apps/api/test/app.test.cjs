const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/kachko_test';
process.env.REDIS_URL = 'redis://127.0.0.1:1';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.DEPENDENCY_TIMEOUT_MS = '100';
const { Test } = require('@nestjs/testing');
const { PrismaService } = require('../dist/database/prisma.service');
const { RedisService } = require('../dist/redis/redis.service');
const { AppModule } = require('../dist/app.module');
const { configureApp } = require('../dist/configure-app');
const { validateEnvironment } = require('../dist/config/environment');

test('configuration rejects invalid ports and unsafe origins', () => {
  assert.throws(() => validateEnvironment({ PORT: 'not-a-port' }));
  assert.throws(() => validateEnvironment({ CORS_ORIGINS: '*' }));
  assert.throws(() => validateEnvironment({ NODE_ENV: 'production' }));
  assert.throws(() => validateEnvironment({ DATABASE_URL: process.env.DATABASE_URL, REDIS_URL: process.env.REDIS_URL, MEDIA_STORAGE: 'r2' }));
  assert.deepEqual(validateEnvironment({ DATABASE_URL: process.env.DATABASE_URL, REDIS_URL: process.env.REDIS_URL }).CORS_ORIGINS, ['http://localhost:3000']);
});

test('Nest HTTP foundation serves health, errors, CORS and OpenAPI', async (t) => {
  const state = { postgres: 'up', redis: 'up' };
  let initialized = 0;
  let disconnected = 0;
  const provider = name => ({
    onModuleInit() { initialized++; },
    onApplicationShutdown() { disconnected++; },
    async ping() {
      if (state[name] === 'down') throw new Error('Do not expose postgres://user:secret@host/db');
      if (state[name] === 'stalled') return new Promise(() => {});
    },
  });
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService).useValue(provider('postgres'))
    .overrideProvider(RedisService).useValue(provider('redis')).compile();
  const app = module.createNestApplication({ logger: false });
  let closed = false;
  t.after(() => closed ? undefined : app.close());
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  assert.equal(initialized, 2);
  const health = await fetch(`${base}/api/v1/health`, { headers: { Origin: 'http://localhost:3000' } });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { data: { status: 'ok' } });
  assert.equal(health.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.equal(health.headers.get('access-control-allow-credentials'), 'true');
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  const denied = await fetch(`${base}/api/v1/health`, { headers: { Origin: 'https://untrusted.example' } });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  const missing = await fetch(`${base}/api/v1/missing`);
  assert.equal(missing.status, 404);
  const error = await missing.json();
  assert.equal(error.error.code, 'NOT_FOUND');
  assert.equal(error.stack, undefined);
  assert.equal((await fetch(`${base}/api/v1/health/live`)).status, 200);
  const schema = await (await fetch(`${base}/api/docs-json`)).json();
  assert.ok(schema.paths['/api/v1/health']);
  assert.ok(schema.paths['/api/v1/media/upload-url']);
  assert.ok(schema.paths['/api/v1/media/complete']);
  assert.ok(schema.paths['/api/v1/health/ready'].get.responses['503']);
  for (const [postgres, redis] of [['up', 'up'], ['down', 'up'], ['up', 'down'], ['down', 'down'], ['stalled', 'up'], ['up', 'up']]) {
    Object.assign(state, { postgres, redis });
    const response = await fetch(`${base}/api/v1/health/ready`, { signal: AbortSignal.timeout(2000) });
    const ready = postgres === 'up' && redis === 'up';
    assert.equal(response.status, ready ? 200 : 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    const checks = ready ? body.data.checks : body.error.checks;
    assert.deepEqual(checks, { postgres: postgres === 'up' ? 'up' : 'down', redis: redis === 'up' ? 'up' : 'down' });
    if (!ready) assert.equal(body.error.code, 'DEPENDENCIES_UNAVAILABLE');
    assert.ok(!JSON.stringify(body).includes('secret'));
    const live = await fetch(`${base}/api/v1/health/live`);
    assert.equal(live.status, 200);
    assert.deepEqual(await live.json(), { data: { status: 'live' } });
  }
  await app.close();
  closed = true;
  assert.equal(disconnected, 2);
});
