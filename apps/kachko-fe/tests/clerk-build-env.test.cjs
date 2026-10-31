/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../lib/clerk-build-env.mjs');

test('production builds name missing Clerk variables and explain the legacy-name mistake', async () => {
  const { assertClerkBuildEnvironment: check } = await load();
  assert.throws(() => check({}), /Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY/);
  assert.throws(() => check({ CLERK_PUBLISHABLE_KEY: 'pk_live_fixture', CLERK_SECRET_KEY: 'sk_live_fixture' }),
    /CLERK_PUBLISHABLE_KEY is set, but Next.js requires NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/);
});

test('production builds reject whitespace and mismatched modes without disclosing keys', async () => {
  const { assertClerkBuildEnvironment: check } = await load();
  const valid = { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_fixture', CLERK_SECRET_KEY: 'sk_live_fixture' };
  for (const env of [{ ...valid, CLERK_SECRET_KEY: 'sk_test_private_fixture' },
    { ...valid, CLERK_SECRET_KEY: 'sk_live_private_fixture\n' },
    { ...valid, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'incorrect_fixture' }]) {
    assert.throws(() => check(env), error => {
      assert.ok(!error.message.includes('private_fixture'));
      return /Kachko build configuration/.test(error.message);
    });
  }
  assert.doesNotThrow(() => check(valid));
  assert.doesNotThrow(() => check({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_fixture', CLERK_SECRET_KEY: 'sk_test_fixture' }));
});
