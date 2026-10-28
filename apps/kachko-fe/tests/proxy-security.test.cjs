/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');

const exportsFor = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/proxy-body.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exportsFor, Uint8Array, RangeError });
const { readProxyBody, MAX_PROXY_BODY_BYTES } = exportsFor;

test('proxy refuses oversized declared bodies before reading them', async () => {
  await assert.rejects(readProxyBody({ headers: new Headers({ 'content-length': String(MAX_PROXY_BODY_BYTES + 1) }),
    get body() { assert.fail('Oversized body must not be read'); } }), RangeError);
});

test('proxy bounds chunked bodies without trusting missing or understated Content-Length', async () => {
  for (const declared of [undefined, '1']) {
    let cancelled = false;
    const request = { headers: new Headers(declared ? { 'content-length': declared } : {}),
      body: new ReadableStream({ start(controller) {
        controller.enqueue(new Uint8Array(MAX_PROXY_BODY_BYTES));
        controller.enqueue(new Uint8Array(1));
      }, cancel() { cancelled = true; } }) };
    await assert.rejects(readProxyBody(request), RangeError);
    assert.equal(cancelled, true);
  }
});

test('proxy preserves exact allowed upload bytes and accepts bodyless requests', async () => {
  const bytes = new Uint8Array(MAX_PROXY_BODY_BYTES).fill(42);
  const request = new Request('http://localhost/upload', { method: 'PUT', body: bytes });
  assert.deepEqual(new Uint8Array(await readProxyBody(request)), bytes);
  assert.equal(await readProxyBody(new Request('http://localhost/read')), undefined);
});
