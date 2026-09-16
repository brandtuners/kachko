/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');

function analyticsClient(context) {
  const output = ts.transpileModule(fs.readFileSync('features/analytics/client.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, Blob, ...context });
  return exports;
}

test('analytics uses Beacon with the exact public event contract', async () => {
  let sent;
  const analytics = analyticsClient({
    navigator: { sendBeacon(url, body) { sent = { url, body }; return true; } },
    fetch() { throw new Error('fetch fallback must not run when Beacon accepts'); },
  });
  analytics.sendAnalyticsEvent({ pageId: 'page-1', blockId: 'block-1', eventType: 'LINK_CLICK' });
  assert.equal(sent.url, '/api/v1/analytics/events');
  assert.equal(sent.body.type, 'application/json');
  assert.deepEqual(JSON.parse(await sent.body.text()), { pageId: 'page-1', blockId: 'block-1', eventType: 'LINK_CLICK' });
});

test('analytics falls back to nonblocking keepalive fetch', async () => {
  let sent;
  const analytics = analyticsClient({
    navigator: { sendBeacon() { return false; } },
    fetch(url, init) { sent = { url, init }; return Promise.resolve(new Response(null, { status: 202 })); },
    Response,
  });
  analytics.sendAnalyticsEvent({ pageId: 'page-1', socialProfileId: 'social-1', eventType: 'SOCIAL_CLICK' });
  await Promise.resolve();
  assert.equal(sent.url, '/api/v1/analytics/events');
  assert.equal(sent.init.keepalive, true);
  assert.equal(sent.init.credentials, 'include');
  assert.deepEqual(JSON.parse(sent.init.body), { pageId: 'page-1', socialProfileId: 'social-1', eventType: 'SOCIAL_CLICK' });
});
