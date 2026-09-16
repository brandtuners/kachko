const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBlockSchema, publicBlockSchema, blockContentSchemas } = require('@kachko/validation');
const examples = {
  IMAGE: { mediaId: '00000000-0000-4000-8000-000000000002', alt: 'Mountain' },
  SOCIAL: { platform: 'GITHUB', username: 'rohan' }, DIVIDER: {},
  YOUTUBE: { videoId: 'dQw4w9WgXcQ' },
  SPOTIFY: { url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC' },
  EMAIL: { email: 'hello@example.com' }, PHONE: { number: '+91 9876543210' }, LOCATION: { query: 'Mumbai, India' },
};
test('all additional blocks validate for creation and public output', () => {
  for (const [type, content] of Object.entries(examples)) {
    const block = createBlockSchema.parse({ type, content });
    assert.equal(block.isVisible, true);
    const responseContent = type === 'IMAGE' ? { ...content, url: '/api/v1/media/files/00000000-0000-4000-8000-000000000002' } : content;
    assert.equal(publicBlockSchema.parse({ id: '00000000-0000-4000-8000-000000000001', type, content: responseContent }).type, type);
    assert.equal(blockContentSchemas[type].safeParse({ ...content, injected: '<script>' }).success, false);
  }
});
test('reject unsafe image, embed and contact inputs', () => {
  for (const [type, content] of [
    ['IMAGE', { mediaId: 'not-a-uuid', alt: 'bad' }],
    ['YOUTUBE', { videoId: '../bad?x=1' }],
    ['SPOTIFY', { url: 'https://open.spotify.com.evil.test/track/4uLU6hMCjMI75M1A2tKUQC' }],
    ['SOCIAL', { platform: 'GITHUB', username: 'https://evil.test' }],
    ['EMAIL', { email: 'x@example.com?bcc=other@example.com' }],
    ['PHONE', { number: '+1234567;ext=9' }],
    ['LOCATION', { query: ' ' }],
  ]) assert.equal(createBlockSchema.safeParse({ type, content }).success, false, type);
});
