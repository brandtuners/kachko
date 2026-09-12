const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { validateEnvironment } = require('../dist/config/environment');
const { HealthService } = require('../dist/modules/health/health.service');

const valid = { DATABASE_URL: 'postgresql://user:pass@localhost:5432/kachko', REDIS_URL: 'redis://localhost:6379' };

test('connection settings are required, validated, and errors do not leak credentials', () => {
  assert.throws(() => validateEnvironment({}), /DATABASE_URL/);
  assert.throws(() => validateEnvironment({ DATABASE_URL: valid.DATABASE_URL }), /REDIS_URL/);
  for (const key of ['DATABASE_URL', 'REDIS_URL']) {
    for (const value of ['', ' ', 'not-a-url', 'http://user:secret@host/path', 'redis://localhost:0']) {
      assert.throws(() => validateEnvironment({ ...valid, [key]: value }), error => error.message.includes(key) && !error.message.includes('secret'));
    }
  }
  assert.throws(() => validateEnvironment({ ...valid, DATABASE_URL: 'postgresql://user:pass@host/' }), /DATABASE_URL/);
  assert.throws(() => validateEnvironment({ ...valid, REDIS_URL: 'redis://host/not-a-db' }), /REDIS_URL/);
  for (const DEPENDENCY_TIMEOUT_MS of [0, -1, 99, 10001, 'NaN', 1.5]) {
    assert.throws(() => validateEnvironment({ ...valid, DEPENDENCY_TIMEOUT_MS }), /DEPENDENCY_TIMEOUT_MS/);
  }
  const config = validateEnvironment({ ...valid, REDIS_URL: 'rediss://user:pass@host:6380/2', DEPENDENCY_TIMEOUT_MS: '500' });
  assert.equal(config.DEPENDENCY_TIMEOUT_MS, 500);
  assert.equal(validateEnvironment(valid).DEPENDENCY_TIMEOUT_MS, 2000);
});

test('concurrent readiness calls share probes, and subsequent calls recheck', async () => {
  let resolve;
  let calls = 0;
  const pending = new Promise(r => { resolve = r; });
  const health = new HealthService({ ping: () => { calls++; return pending; } }, { ping: async () => {} }, new ConfigService({ DEPENDENCY_TIMEOUT_MS: 100 }));
  const requests = [health.readiness(), health.readiness(), health.readiness()];
  resolve();
  for (const result of await Promise.all(requests)) assert.equal(result.ready, true);
  assert.equal(calls, 1);
  await health.readiness();
  assert.equal(calls, 2);
  health.onModuleDestroy();
  assert.equal((await health.readiness()).ready, false);
  assert.equal(calls, 2);
});

test('shutdown during an active probe never reports ready', async () => {
  let resolve;
  const probe = new Promise(r => { resolve = r; });
  const health = new HealthService({ ping: () => probe }, { ping: async () => {} }, new ConfigService({ DEPENDENCY_TIMEOUT_MS: 100 }));
  const result = health.readiness();
  health.onModuleDestroy();
  resolve();
  assert.equal((await result).ready, false);
});
