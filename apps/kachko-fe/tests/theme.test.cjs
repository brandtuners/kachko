const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const helpers = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('features/page/theme.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: helpers });
test('catalog themes use saved backgrounds and button variants', () => {
  const sql = fs.readFileSync('../../prisma/migrations/20260916110000_add_neon_system_themes/migration.sql', 'utf8');
  const backgrounds = new Set();
  for (const line of sql.split('\n').filter(line => line.startsWith('INSERT'))) {
    const [background, typography, buttons, cards] = [...line.matchAll(/'([^']+)'::jsonb/g)].map(m => JSON.parse(m[1]));
    const theme = { config: { background, typography, buttons, cards } };
    backgrounds.add(helpers.themeBackground(theme));
    const vars = helpers.themeVars(theme);
    assert.equal(vars['--button-radius'], '24px');
    assert.equal(vars['--page-text'], typography.color);
    assert.equal(vars['--button-bg'], buttons.variant === 'filled' ? buttons.background : buttons.variant === 'glass' ? buttons.background + '33' : 'transparent');
  }
  assert.equal(backgrounds.size, 5);
});
test('light solid themes retain readable text and solid background', () => {
  const theme = { config: { background: { type: 'solid', color: '#FFFFFF' }, typography: { color: '#111827', titleSize: 32, fontFamily: 'system' }, buttons: { variant: 'filled', radius: 12, background: '#111827', color: '#FFFFFF', shadow: false }, cards: { background: '#FFFFFF' } } };
  assert.equal(helpers.themeBackground(theme), '#FFFFFF');
  assert.equal(helpers.themeVars(theme)['--page-text'], '#111827');
});
