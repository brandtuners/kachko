const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { InstagramProvider, nullableCount } = require('../dist/modules/social/instagram.provider');
const config = () => new ConfigService({ SOCIAL_INSTAGRAM_CLIENT_ID: '12345', SOCIAL_INSTAGRAM_CLIENT_SECRET: 'app-secret',
  SOCIAL_INSTAGRAM_REDIRECT_URI: 'https://kachko.example/api/v1/social/callback/instagram', SOCIAL_INSTAGRAM_WEBHOOK_VERIFY_TOKEN: 'verify-secret',
  SOCIAL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'), SOCIAL_INSTAGRAM_API_VERSION: 'v25.0' });

test('Instagram OAuth uses current professional permissions and exchanges nested token responses', async t => {
  const provider = new InstagramProvider(config());
  const url = new URL(provider.authorize('bound-state'));
  assert.equal(url.origin, 'https://www.instagram.com');
  assert.equal(url.searchParams.get('state'), 'bound-state');
  assert.ok(url.searchParams.get('scope').includes('instagram_business_manage_insights'));
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify(calls.length === 1 ? { data: [{ access_token: 'short', permissions: 'instagram_business_basic,instagram_business_manage_comments' }] }
      : { access_token: 'long', expires_in: 3600 }));
  });
  const token = await provider.exchange('one-use-code');
  assert.equal(token.accessToken, 'long');
  assert.ok(token.expiresAt > new Date());
  assert.equal(calls[0].url, 'https://api.instagram.com/oauth/access_token');
  assert.equal(calls[0].options.body.get('client_secret'), 'app-secret');
  assert.equal(new URL(calls[1].url).searchParams.get('grant_type'), 'ig_exchange_token');
});

test('Instagram private reply spends one message on the comment ID and keeps bearer credentials out of URL', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({ url: String(url), options }); return new Response(JSON.stringify({ message_id: 'confirmed' })); });
  const provider = new InstagramProvider(config());
  assert.equal(await provider.sendPrivateReply('111', 'private-token', '222', 'Here you go', 'Open', 'https://kachko.example/d/opaque'), 'confirmed');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://graph.instagram.com/v25.0/111/messages');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer private-token');
  assert.deepEqual(JSON.parse(calls[0].options.body), { recipient: { comment_id: '222' }, message: { text: 'Here you go\n\nOpen: https://kachko.example/d/opaque' } });
});

test('Instagram distinguishes expired grants, rejected sends and uncertain network outcomes without exposing secrets', async t => {
  const provider = new InstagramProvider(config());
  let response = () => new Response(JSON.stringify({ error: { code: 190, message: 'secret-token' } }), { status: 400 });
  t.mock.method(globalThis, 'fetch', async () => response());
  await assert.rejects(provider.profile('secret-token'), error => error.reconnect && !error.message.includes('secret-token'));
  response = () => new Response(JSON.stringify({ error: { code: 100 } }), { status: 400 });
  await assert.rejects(provider.sendPrivateReply('111', 'secret-token', '222', 'hi', 'Open', 'https://example.com'), error => !error.ambiguous);
  response = () => { throw new Error('secret-token'); };
  await assert.rejects(provider.sendPrivateReply('111', 'secret-token', '222', 'hi', 'Open', 'https://example.com'), error => error.ambiguous && !error.message.includes('secret-token'));
});

test('Instagram insights use views totals and preserve unavailable reports rather than fabricate zero', async t => {
  const urls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    const parsed = new URL(url); urls.push(parsed);
    if (parsed.pathname.endsWith('/me')) return new Response(JSON.stringify({ user_id: '111', username: 'creator', followers_count: '123', media_count: 4 }));
    if (parsed.pathname.endsWith('/media')) return new Response(JSON.stringify({ data: [] }));
    if (parsed.searchParams.get('metric') === 'views,reach') return new Response(JSON.stringify({ data: [{ name: 'views', total_value: { value: 120 } }, { name: 'reach', total_value: { value: 80 } }] }));
    return new Response(JSON.stringify({ data: [] }));
  });
  const result = await new InstagramProvider(config()).collect('111', 'private-token');
  assert.equal(result.profile.followers, 123);
  assert.deepEqual(result.history, []);
  assert.equal(result.totals.views, 120);
  assert.equal(result.totals.reach, 80);
  assert.equal(result.totals.demographics.countries, null);
  const viewsQuery = urls.find(url => url.searchParams.get('metric') === 'views,reach');
  assert.equal(viewsQuery.searchParams.get('metric_type'), 'total_value');
  assert.equal(nullableCount(false), null);
  assert.equal(nullableCount(''), null);
  assert.equal(nullableCount('0'), 0);
});
