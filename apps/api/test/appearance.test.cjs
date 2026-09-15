const { test } = require('node:test');
const assert = require('node:assert/strict');
const { updateAppearanceSchema, appearanceOverridesSchema, createSocialSchema, updateSocialSchema, applyTemplateSchema } = require('@kachko/validation');

test('appearance accepts allowlisted values and rejects CSS/URLs, extra fields and out-of-range options', () => {
  assert.equal(updateAppearanceSchema.safeParse({ themeKey: 'dark' }).success, true);
  assert.deepEqual(appearanceOverridesSchema.parse({ buttons: { radius: 20 } }), { buttons: { radius: 20 } });
  for (const overrides of [{ css: 'body{}' }, { background: { type: 'image', url: 'https://example.com' } },
    { background: { type: 'solid', color: '#fff;display:none' } }, { typography: { fontFamily: 'url(evil)' } },
    { buttons: { radius: -1 } }, { cards: { blur: 25 } }, { typography: { titleSize: 49 } }]) {
    assert.equal(updateAppearanceSchema.safeParse({ overrides }).success, false);
  }
  assert.equal(updateAppearanceSchema.safeParse({}).success, false);
  assert.equal(updateAppearanceSchema.safeParse({ themeKey: 'custom' }).success, false);
  assert.deepEqual(applyTemplateSchema.parse({ templateKey: 'starter' }), { templateKey: 'starter', replaceExistingBlocks: false });
});

test('social URL/platform validation rejects spoofing and protects server-managed fields', () => {
  assert.equal(createSocialSchema.parse({ platform: 'YOUTUBE', url: 'HTTPS://WWW.YOUTUBE.COM/@test' }).url, 'https://www.youtube.com/@test');
  for (const url of ['https://github.com.evil.example/test', 'https://evilgithub.com/test', 'javascript:alert(1)',
    'https://user:pass@github.com/test', 'https://github.com:444/test', '//github.com/test', 'https://github.com\\@evil.example', 'https://instagram.com/test']) {
    assert.equal(createSocialSchema.safeParse({ platform: 'GITHUB', url }).success, false, url);
  }
  assert.equal(createSocialSchema.safeParse({ platform: 'GITHUB', url: 'https://github.com/test', pageId: 'foreign' }).success, false);
  assert.equal(updateSocialSchema.safeParse({ position: 5 }).success, false);
  assert.equal(updateSocialSchema.safeParse({}).success, false);
});

test('new system theme migration rows match the runtime theme contract', () => {
  const fs = require('node:fs');
  const { themeConfigSchema, themeKeySchema } = require('@kachko/validation');
  const sql = fs.readFileSync('../../prisma/migrations/20260916110000_add_neon_system_themes/migration.sql', 'utf8');
  const inserts = sql.split('\n').filter(line => line.startsWith('INSERT'));
  assert.equal(inserts.length, 5);
  for (const line of inserts) {
    const configs = [...line.matchAll(/'([^']+)'::jsonb/g)].map(match => JSON.parse(match[1]));
    assert.equal(themeConfigSchema.safeParse({ background: configs[0], typography: configs[1], buttons: configs[2], cards: configs[3] }).success, true);
  }
  for (const key of ['aurora', 'neon-pop', 'cyan-pulse', 'sunset-lime', 'coral-drift']) assert.equal(themeKeySchema.parse(key), key);
});
