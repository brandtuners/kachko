const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { IdentityRateGuard } = require('../dist/modules/identity/identity.guards');

function context(response, ip = '203.0.113.10') {
  return { getHandler: () => function handler() {}, getClass: () => function controller() {}, switchToHttp: () => ({
    getRequest: () => ({ ip, socket: { remoteAddress: ip } }),
    getResponse: () => response,
  }) };
}

function guard(reply, ready = true) {
  const redis = { client: {
    isReady: ready,
    withCommandOptions: () => ({ eval: async () => reply }),
  } };
  const reflector = { getAllAndOverride: () => ({ name: 'password-reset-request', limit: 3, seconds: 3600 }) };
  return new IdentityRateGuard(redis, new ConfigService({ DEPENDENCY_TIMEOUT_MS: 100 }), reflector);
}

test('rate guard allows requests within the policy', async () => {
  const headers = {};
  assert.equal(await guard([3, 3600]).canActivate(context({ setHeader: (name, value) => { headers[name] = value; } })), true);
  assert.equal(headers['Cache-Control'], 'no-store');
});

test('rate guard rejects excess requests with Retry-After', async () => {
  const headers = {};
  await assert.rejects(
    guard([4, 3598]).canActivate(context({ setHeader: (name, value) => { headers[name] = value; } })),
    error => error.getStatus() === 429 && error.getResponse().code === 'RATE_LIMITED',
  );
  assert.equal(headers['Retry-After'], '3598');
});

test('rate guard fails closed when Redis is unavailable', async () => {
  await assert.rejects(
    guard([1, 3600], false).canActivate(context({ setHeader() {} })),
    error => error.getStatus() === 503 && error.getResponse().code === 'DEPENDENCIES_UNAVAILABLE',
  );
});
