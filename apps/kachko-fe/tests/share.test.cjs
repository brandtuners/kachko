/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');

function urls(origin = 'https://kachko.app') {
  const output = ts.transpileModule(fs.readFileSync('lib/public-url.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, process: { env: { NEXT_PUBLIC_APP_URL: origin } }, URL });
  return exports;
}

test('canonical public and QR destination use the /username address', () => {
  assert.equal(urls().publicPageUrl('rohan.dev'), 'https://kachko.app/rohan.dev');
  assert.equal(urls().publicPageUrl('name space', 'http://localhost:3000'), 'http://localhost:3000/name%20space');
  assert.equal(urls().publicPageUrl('rohan', 'https://kachko.app', 'portfolio'), 'https://kachko.app/rohan/portfolio');
});

test('public metadata uses the shared canonical URL and absolute assets', () => {
  const source = fs.readFileSync('app/u/[username]/page.tsx', 'utf8');
  assert.match(source, /publicPageUrl\(page\.user\.username, undefined, page\.isPrimary/);
  assert.match(source, /absoluteAssetUrl\(page\.user\.avatarUrl\)/);
  assert.match(source, /alternates: \{ canonical: shareUrl \}/);
});
