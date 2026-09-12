const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
require('reflect-metadata');

const exec = promisify(execFile);
const docker = async (...args) => (await exec('docker', args, { timeout: 120000 })).stdout.trim();

// Opt-in: starts and removes only uniquely named temporary containers. No dev DB is used.
test('real providers recover from startup outages and stalled dependencies, then shut down', { timeout: 180000 }, async (t) => {
  await docker('info', '--format', '{{.ServerVersion}}');
  const suffix = randomUUID().slice(0, 8);
  const postgres = `kachko-ready-pg-${suffix}`;
  const redis = `kachko-ready-redis-${suffix}`;
  const created = [];
  let app;
  t.after(async () => {
    // Unpause before teardown even when an assertion fails.
    await Promise.all(created.map(name => docker('unpause', name).catch(() => {})));
    try { if (app) await app.close(); }
    finally { await Promise.all(created.map(name => docker('rm', '--force', '--volumes', name))); }
  });
  await docker('run', '--detach', '--name', postgres, '--tmpfs', '/var/lib/postgresql/data',
    '-e', 'POSTGRES_USER=kachko', '-e', 'POSTGRES_PASSWORD=test_only', '-e', 'POSTGRES_DB=kachko_ready_test',
    '-p', '127.0.0.1::5432', 'postgres:16-alpine');
  created.push(postgres);
  await docker('run', '--detach', '--name', redis, '--tmpfs', '/data', '-p', '127.0.0.1::6379', 'redis:7-alpine');
  created.push(redis);
  const pgPort = (await docker('port', postgres, '5432/tcp')).split(':').at(-1);
  const redisPort = (await docker('port', redis, '6379/tcp')).split(':').at(-1);
  // Pause rather than stop so Docker keeps each dynamically allocated host port stable.
  await docker('pause', postgres);
  await docker('pause', redis);

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `postgresql://kachko:test_only@127.0.0.1:${pgPort}/kachko_ready_test`;
  process.env.REDIS_URL = `redis://127.0.0.1:${redisPort}`;
  process.env.CORS_ORIGINS = 'http://localhost:3000';
  process.env.DEPENDENCY_TIMEOUT_MS = '500';
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../../dist/app.module');
  const { configureApp } = require('../../dist/configure-app');
  const { RedisService } = require('../../dist/redis/redis.service');
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const response = async path => {
    const res = await fetch(`${base}/api/v1/health/${path}`, { signal: AbortSignal.timeout(4000) });
    return { status: res.status, body: await res.json() };
  };
  const waitFor = async expected => {
    for (let i = 0; i < 40; i++) {
      const res = await response('ready');
      const checks = res.body.data?.checks ?? res.body.error?.checks;
      if (checks?.postgres === expected.postgres && checks?.redis === expected.redis) return res;
      await delay(250);
    }
    assert.fail(`Readiness did not become ${JSON.stringify(expected)}`);
  };
  assert.equal((await waitFor({ postgres: 'down', redis: 'down' })).status, 503);
  assert.equal((await response('live')).status, 200);

  await docker('unpause', postgres);
  assert.equal((await waitFor({ postgres: 'up', redis: 'down' })).status, 503);
  await docker('unpause', redis);
  assert.equal((await waitFor({ postgres: 'up', redis: 'up' })).status, 200);

  for (const dependency of [postgres, redis]) {
    await docker('pause', dependency);
    const res = await response('ready');
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'DEPENDENCIES_UNAVAILABLE');
    assert.ok(!JSON.stringify(res.body).includes('test_only'));
    assert.equal((await response('live')).status, 200);
    await docker('unpause', dependency);
    assert.equal((await waitFor({ postgres: 'up', redis: 'up' })).status, 200);
  }

  const redisClient = app.get(RedisService).client;
  await app.close();
  app = undefined;
  assert.equal(redisClient.isOpen, false);
  assert.equal(redisClient.isReady, false);
  const sessions = await docker('exec', postgres, 'psql', '-U', 'kachko', '-d', 'kachko_ready_test', '-Atc',
    "SELECT count(*) FROM pg_stat_activity WHERE usename = 'kachko' AND datname = 'kachko_ready_test' AND backend_type = 'client backend' AND pid <> pg_backend_pid()");
  assert.equal(sessions, '0', 'Prisma pool must release connections on shutdown');
});
