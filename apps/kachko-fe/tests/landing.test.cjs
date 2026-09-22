/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('landing page advertises only implemented product capabilities', () => {
  const source = fs.readFileSync('features/marketing/landing.tsx', 'utf8');
  assert.match(source, /kachko\.in\/girish/);
  assert.match(source, /Multiple pages and content blocks/);
  assert.match(source, /Themes, templates and design controls/);
  assert.match(source, /Privacy-safe basic analytics/);
  assert.doesNotMatch(source, /kachko\.(?:app|com)/);
  assert.doesNotMatch(source, /Kachko Pro|Custom domains|Advanced analytics|Go Pro/);
  assert.doesNotMatch(source, /\bV1\b/);
});
