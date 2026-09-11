const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { configureApp } = require('../dist/configure-app');
const { validateEnvironment } = require('../dist/config/environment');

test('configuration rejects invalid ports and unsafe origins', () => {
  assert.throws(() => validateEnvironment({ PORT: 'not-a-port' }));
  assert.throws(() => validateEnvironment({ CORS_ORIGINS: '*' }));
  assert.throws(() => validateEnvironment({ NODE_ENV: 'production' }));
  assert.deepEqual(validateEnvironment({}).CORS_ORIGINS, ['http://localhost:3000']);
});

test('Nest HTTP foundation serves health, errors, CORS and OpenAPI', async (t) => {
  const app = await NestFactory.create(AppModule, { logger: false });
  t.after(() => app.close());
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
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
});
