const { test } = require('node:test');
const assert = require('node:assert/strict');
const { linkUrlSchema, createPageSchema, updatePageSchema, createLinkBlockSchema, updateLinkBlockSchema } = require('@kachko/validation');

test('LINK contracts normalize safe destinations and reject dangerous or ambiguous URLs', () => {
  assert.equal(linkUrlSchema.parse('HTTPS://Example.COM'), 'https://example.com/');
  assert.equal(linkUrlSchema.parse('https://example.com/a?q=a%20b#section'), 'https://example.com/a?q=a%20b#section');
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'mailto:a@example.com', 'tel:123',
    '//example.com', '/relative', 'https:example.com', 'https://user:pass@example.com',
    ' https://example.com', 'https://example.com\n', 'https://exam\tple.com', 'https://example.com\\path',
    'https://example.com/a b', 'https://', 'https://example.com/' + 'x'.repeat(2048)]) {
    assert.equal(linkUrlSchema.safeParse(url).success, false, url);
  }
});

test('page and block requests protect server-owned fields and require complete LINK content', () => {
  assert.deepEqual(createPageSchema.parse({}), {});
  assert.deepEqual(createPageSchema.parse({ slug: ' My-Work ' }), { slug: 'my-work' });
  for (const body of [{ slug: 'not valid!' }, { userId: 'foreign' }, { isPublished: true }, { themeKey: 'unsafe' }]) {
    assert.equal(createPageSchema.safeParse(body).success, false);
  }
  assert.equal(updatePageSchema.safeParse({}).success, false);
  assert.deepEqual(updatePageSchema.parse({ title: null, description: ' About ' }), { title: null, description: 'About' });
  assert.deepEqual(createLinkBlockSchema.parse({ type: 'LINK', content: { title: ' Site ', url: 'https://example.com' } }),
    { type: 'LINK', content: { title: 'Site', url: 'https://example.com/', openInNewTab: true }, isVisible: true });
  for (const body of [{ type: 'TEXT', content: { text: 'no' } }, { type: 'LINK', content: { title: 'x', url: 'https://example.com' }, position: 4 },
    { type: 'LINK', content: { title: 'x', url: 'https://example.com', thumbnailMediaId: 'foreign' } }]) {
    assert.equal(createLinkBlockSchema.safeParse(body).success, false);
  }
  assert.equal(updateLinkBlockSchema.safeParse({ content: { title: 'title only' } }).success, false);
  assert.equal(updateLinkBlockSchema.safeParse({}).success, false);
  assert.deepEqual(updateLinkBlockSchema.parse({ isVisible: false }), { isVisible: false });
});

test('TEXT validation preserves plain text and bounds content; mixed block schemas stay strict', () => {
  const { createBlockSchema, updateBlockSchema, textContentSchema, publicPageSchema } = require('@kachko/validation');
  assert.deepEqual(createBlockSchema.parse({ type: 'TEXT', content: { text: ' Hello\nworld ' } }),
    { type: 'TEXT', content: { text: ' Hello\nworld ', alignment: 'left' }, isVisible: true });
  for (const content of [{ text: '' }, { text: ' \n\t' }, { text: 'x'.repeat(5001) }, { text: 'x', alignment: 'justify' }, { text: 'x', html: '<b>x</b>' }]) {
    assert.equal(textContentSchema.safeParse(content).success, false);
  }
  assert.equal(updateBlockSchema.safeParse({ type: 'TEXT', content: { text: 'x' } }).success, false);
  assert.equal(updateBlockSchema.safeParse({ content: { text: 'x', title: 'x', url: 'https://example.com' } }).success, false);
  const publicData = { profile: { username: 'test', displayName: null, bio: null, avatarUrl: null },
    page: { id: '20da19cc-7e63-4aa9-8cc0-7d68c26acbd2', slug: 'test', isPrimary: true, title: null, description: null, themeKey: 'minimal', appearance: { background: { type: 'solid', color: '#FFFFFF' }, typography: { fontFamily: 'system', titleSize: 32, color: '#111827' }, buttons: { variant: 'filled', radius: 12, background: '#111827', color: '#FFFFFF', shadow: false }, cards: { radius: 12, background: '#FFFFFF', blur: 0 } } }, socials: [], blocks: [{ id: 'd6f0b953-461d-43b7-8e16-dbd98c10c1a1', type: 'TEXT', content: { text: '<b>plain text</b>', alignment: 'right' } }] };
  assert.equal(publicPageSchema.parse(publicData).blocks[0].content.text, '<b>plain text</b>');
});

test('reorder validates IDs, unique positions and complete zero-based ranges', () => {
  const { reorderBlocksSchema } = require('@kachko/validation');
  const a = 'd6f0b953-461d-43b7-8e16-dbd98c10c1a1';
  const b = 'd6f0b953-461d-43b7-8e16-dbd98c10c1a2';
  assert.equal(reorderBlocksSchema.safeParse({ items: [] }).success, true);
  assert.equal(reorderBlocksSchema.safeParse({ items: [{ id: a, position: 1 }, { id: b, position: 0 }] }).success, true);
  for (const items of [[{ id: a, position: 0 }, { id: a, position: 1 }], [{ id: a, position: 0 }, { id: b, position: 0 }],
    [{ id: a, position: -1 }], [{ id: a, position: 0.5 }], [{ id: a, position: 1 }], [{ id: 'bad', position: 0 }]]) {
    assert.equal(reorderBlocksSchema.safeParse({ items }).success, false);
  }
});
