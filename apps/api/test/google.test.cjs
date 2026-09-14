const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { GoogleProvider } = require('../dist/modules/identity/google.provider');
const { validateEnvironment } = require('../dist/config/environment');

test('Google provider requires configuration and verified email/nonce after SDK verification', async () => {
  assert.throws(() => new GoogleProvider(new ConfigService({})).assertEnabled());
  const provider = new GoogleProvider(new ConfigService({ GOOGLE_CLIENT_ID: 'test-client' }));
  let payload = { sub: 'subject', email: 'Test@Example.com', email_verified: true, nonce: 'expected' };
  let verified = false;
  provider.client = {
    getToken: async input => { assert.equal(input.codeVerifier, 'verifier'); return { tokens: { id_token: 'token' } }; },
    verifyIdToken: async input => { assert.deepEqual(input, { idToken: 'token', audience: 'test-client' }); verified = true; return { getPayload: () => payload }; },
  };
  assert.deepEqual(await provider.exchange('code', 'verifier', 'expected'), { subject: 'subject', email: 'test@example.com' });
  assert.equal(verified, true);
  for (const invalid of [{ ...payload, nonce: 'wrong' }, { ...payload, email_verified: false }, { ...payload, sub: '' }, { ...payload, email: 'invalid' }]) {
    const original = payload;
    payload = invalid;
    await assert.rejects(provider.exchange('code', 'verifier', 'expected'), error => error.getResponse().code === 'GOOGLE_AUTH_FAILED');
    payload = original;
  }
  provider.client.verifyIdToken = async () => { throw new Error('Invalid signature or audience; secret-provider-details'); };
  await assert.rejects(provider.exchange('code', 'verifier', 'expected'), error => {
    assert.ok(!JSON.stringify(error.getResponse()).includes('secret-provider-details'));
    return error.getStatus() === 401;
  });
});

test('Google configuration is optional, complete, HTTPS in production and has fixed trusted redirects', () => {
  const env = { DATABASE_URL: 'postgresql://test:test@localhost/test', REDIS_URL: 'redis://localhost', CORS_ORIGINS: 'https://app.example.com' };
  assert.equal(validateEnvironment(env).GOOGLE_CLIENT_ID, '');
  assert.throws(() => validateEnvironment({ ...env, GOOGLE_CLIENT_ID: 'client' }));
  const enabled = { ...env, GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'test-secret' };
  assert.equal(validateEnvironment(enabled).GOOGLE_REDIRECT_URI, 'http://localhost:4000/api/v1/auth/google/callback');
  assert.throws(() => validateEnvironment({ ...enabled, NODE_ENV: 'production' }));
  assert.throws(() => validateEnvironment({ ...enabled, GOOGLE_LOGIN_REDIRECT_URL: 'https://evil.example/callback' }));
  assert.throws(() => validateEnvironment({ ...enabled, GOOGLE_REDIRECT_URI: 'https://api.example.com/wrong' }));
  assert.equal(validateEnvironment({ ...enabled, NODE_ENV: 'production', GOOGLE_REDIRECT_URI: 'https://api.example.com/api/v1/auth/google/callback', GOOGLE_LOGIN_REDIRECT_URL: 'https://app.example.com/auth/google/callback' }).GOOGLE_LOGIN_REDIRECT_URL, 'https://app.example.com/auth/google/callback');
});
