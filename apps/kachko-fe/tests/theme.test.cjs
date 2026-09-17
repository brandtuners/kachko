/* eslint-disable @typescript-eslint/no-require-imports */
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
    assert.equal(vars['--button-bg'], buttons.variant === 'filled' ? buttons.background : buttons.variant === 'glass' ? cards.background : 'transparent');
  }
  assert.equal(backgrounds.size, 5);
});
test('light solid themes retain readable text and solid background', () => {
  const theme = { config: { background: { type: 'solid', color: '#FFFFFF' }, typography: { color: '#111827', titleSize: 32, fontFamily: 'system' }, buttons: { variant: 'filled', radius: 12, background: '#111827', color: '#FFFFFF', shadow: false }, cards: { background: '#FFFFFF' } } };
  assert.equal(helpers.themeBackground(theme), '#FFFFFF');
  assert.equal(helpers.themeVars(theme)['--page-text'], '#111827');
});

test('uploaded backgrounds apply saved fit and focal position without repeating', () => {
  const theme = { config: { background: { type: 'solid', color: '#111312', imageMediaId: '20da19cc-7e63-4aa9-8cc0-7d68c26acbd2', imageOpacity: 0.4, imageFit: 'contain', imagePositionX: 20, imagePositionY: 75 }, typography: { color: '#FFFFFF', titleSize: 32, fontFamily: 'system' }, buttons: { variant: 'filled', radius: 12, background: '#111827', color: '#FFFFFF', shadow: false }, cards: { background: '#FFFFFF' } } };
  const background = helpers.themeBackground(theme);
  assert.match(background, /20% 75% \/ contain no-repeat/);
  assert.match(background, /rgba\(0,0,0,0\.6\)/);
});

test('title color can differ from page copy color', () => {
  const theme = { config: { background: { type: 'solid', color: '#FFFFFF' }, typography: { color: '#111827', titleColor: '#AABBCC', titleSize: 32, fontFamily: 'system' }, buttons: { variant: 'filled', radius: 12, background: '#111827', color: '#FFFFFF', shadow: false }, cards: { background: '#FFFFFF' }, footer: { visible: true } } };
  assert.equal(helpers.themeVars(theme)['--page-title-color'], '#AABBCC');
});

test('expanded page fonts map to safe CSS font stacks', () => {
  for (const fontFamily of ['manrope', 'dmSans', 'inter', 'lato', 'poppins', 'spaceGrotesk', 'verdana', 'trebuchet', 'lora', 'playfair', 'times', 'palatino', 'spaceMono', 'courier']) {
    const theme = { config: { background: { type: 'solid', color: '#FFFFFF' }, typography: { color: '#111827', titleSize: 32, fontFamily }, buttons: { variant: 'filled', radius: 12, background: '#111827', color: '#FFFFFF', shadow: false }, cards: { background: '#FFFFFF' }, footer: { visible: true } } };
    assert.ok(helpers.themeVars(theme)['--page-font'].length > 5, fontFamily);
  }
});

test('Cyan Pulse reference uses glow, translucent cards, subtle border and compact heading', () => {
  const original = fs.readFileSync('../../prisma/migrations/20260916110000_add_neon_system_themes/migration.sql', 'utf8').split('\n').find(line => line.includes("'cyan-pulse'"));
  const [background, typography, buttons, cards] = [...original.matchAll(/'([^']+)'::jsonb/g)].map(m => JSON.parse(m[1]));
  const update = fs.readFileSync('../../prisma/migrations/20260916120000_refine_neon_theme_presentation/migration.sql', 'utf8').split('\n').find(line => line.includes("'cyan-pulse'"));
  const patches = [...update.matchAll(/'([^']+)'::jsonb/g)].map(m => JSON.parse(m[1]));
  const config = { background: {...background, ...patches[0]}, typography: {...typography, ...patches[1]}, buttons: {...buttons, ...patches[2]}, cards: {...cards, ...patches[3]} };
  const vars = helpers.themeVars({config});
  assert.equal(vars['--button-bg'], '#22e3ff0d');
  assert.equal(vars['--blk-card-border'], '#22e3ff38');
  assert.equal(vars['--page-title-size'], '20px');
  assert.match(helpers.themeBackground({config}), /radial-gradient/);
  assert.match(helpers.themeBackground({config}), /#041826/);
});
