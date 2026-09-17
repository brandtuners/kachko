/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
function client(fetch) {
  const output = ts.transpileModule(fs.readFileSync('lib/api.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, process, Headers, FormData, fetch });
  return exports;
}
test('all mutation methods include CSRF, cookies and caller headers', async () => {
  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
    const api = client(async (url, init) => {
      assert.equal(url, '/api/v1/auth/login');
      assert.equal(init.headers.get('X-Kachko-CSRF'), '1');
      assert.equal(init.headers.get('X-Test'), 'yes');
      assert.equal(init.credentials, 'include');
      return Response.json({ data: { ok: true } });
    });
    assert.equal((await api.apiFetch('/auth/login', { method, headers: new Headers({ 'X-Test': 'yes' }), body: '{}' })).ok, true);
  }
});
test('non-JSON HTTP failures and malformed success responses reject', async () => {
  await assert.rejects(client(async () => new Response('bad gateway', { status: 502 })).apiFetch('/pages'), { code: 'HTTP_502' });
  await assert.rejects(client(async () => Response.json({})).apiFetch('/pages'), { code: 'INVALID_RESPONSE' });
});
test('preserves API errors and does not send CSRF on reads', async () => {
  const api = client(async (_, init) => {
    assert.equal(init.headers.has('X-Kachko-CSRF'), false);
    return Response.json({ error: { code: 'UNAUTHENTICATED', message: 'Log in' } }, { status: 401 });
  });
  await assert.rejects(api.apiFetch('/pages'), { code: 'UNAUTHENTICATED' });
});
test('analytics ingestion is available through the shared same-origin client', async () => {
  const api = client(async (url, init) => {
    assert.equal(url, '/api/v1/analytics/events');
    assert.equal(init.headers.get('X-Kachko-CSRF'), '1');
    return Response.json({ data: { accepted: true } }, { status: 202 });
  });
  assert.equal((await api.apiFetch('/analytics/events', { method: 'POST', body: '{"eventType":"PAGE_VIEW"}' })).accepted, true);
});
test('editor uses page IDs and documented reorder, publish and appearance bodies', async () => {
  const calls = [];
  const page = { id: 'page-1', themeKey: 'minimal', blocks: [], socials: [], appearance: {} };
  const apiFetch = async (path, init) => {
    calls.push({ path, ...init });
    if (path === '/pages') return [{ id: 'page-1' }];
    if (path === '/users/me') return { username: 'rohan' };
    return page;
  };
  const output = ts.transpileModule(fs.readFileSync('features/editor/api.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: () => ({ apiFetch, ApiClientError: Error }) });
  await exports.reorderBlocks(['b2', 'b1']);
  assert.deepEqual(JSON.parse(calls.find(c => c.path.endsWith('/reorder')).body), { items: [{ id: 'b2', position: 0 }, { id: 'b1', position: 1 }] });
  await exports.updatePageMeta({ isPublished: true });
  assert.ok(calls.some(c => c.path === '/pages/page-1/publish' && c.method === 'POST'));
  await exports.setTheme('dark');
  assert.deepEqual(JSON.parse(calls.find(c => c.path.endsWith('/appearance')).body), { themeKey: 'dark' });
  assert.ok(calls.every(c => !c.path.includes('/pages/me')));
});
test('public page adapter exposes appearance tokens to the public renderer', () => {
  const source = fs.readFileSync('features/page/public-page.ts', 'utf8');
  assert.match(source, /\.\.\.result\.page\.appearance/);
  assert.match(source, /config: result\.page\.appearance/);
});
