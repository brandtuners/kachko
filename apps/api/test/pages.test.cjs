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
  for (const body of [{ slug: 'other' }, { userId: 'foreign' }, { isPublished: true }, { themeKey: 'unsafe' }]) {
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
