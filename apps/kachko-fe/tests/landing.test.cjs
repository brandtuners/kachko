/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('landing page advertises implemented free and paid product capabilities', () => {
  const source = fs.readFileSync('features/marketing/landing.tsx', 'utf8');
  assert.match(source, /kachko\.in\/girish/);
  assert.match(source, /Unlimited links and content blocks/);
  assert.match(source, /Remove Kachko branding/);
  assert.match(source, /Export audience data to CSV/);
  assert.match(source, /See live pricing/);
  assert.match(source, /Claim yours/);
  assert.match(source, /Questions, answered/);
  assert.match(source, /\/users\/username\//);
  assert.doesNotMatch(source, /kachko\.(?:app|com)/);
  assert.doesNotMatch(source, /Custom domains|Advanced analytics|Smart routing|Go Pro/);
  assert.doesNotMatch(source, /\bV1\b/);
});
