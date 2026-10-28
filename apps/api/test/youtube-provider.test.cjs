const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { ConfigService } = require('@nestjs/config');
const { YoutubeProvider } = require('../dist/modules/social/youtube.provider');

const configured = () => new YoutubeProvider(new ConfigService({ SOCIAL_YOUTUBE_CLIENT_ID: 'client',
  SOCIAL_YOUTUBE_CLIENT_SECRET: 'secret', SOCIAL_YOUTUBE_REDIRECT_URI: 'https://api.example.com/api/v1/social/oauth/youtube/callback' }));
const channel = { id: 'UCmine', snippet: { title: 'My channel', customUrl: '@mychannel', thumbnails: { high: { url: 'https://yt.example/avatar' } } },
  statistics: { subscriberCount: '123', viewCount: '987', videoCount: '2' }, contentDetails: { relatedPlaylists: { uploads: 'UUuploads' } } };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('YouTube authorization binds state, PKCE and explicit offline read-only scopes', () => {
  const provider = configured();
  const url = new URL(provider.authorize('server-state', 'pkce-verifier'));
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('state'), 'server-state');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update('pkce-verifier').digest('base64url'));
  assert.deepEqual(url.searchParams.get('scope').split(' '), ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly']);
  const disabled = new YoutubeProvider(new ConfigService({}));
  assert.equal(disabled.configured(), false);
  assert.throws(() => disabled.authorize('state'), error => error.code === 'YOUTUBE_NOT_CONFIGURED');
});

test('YouTube token exchange passes PKCE and refresh retains the provider refresh token', async () => {
  const provider = configured();
  provider.client = () => ({ getToken: async params => {
    assert.deepEqual(params, { code: 'authorization-code', codeVerifier: 'verifier' });
    return { tokens: { access_token: 'access', refresh_token: 'refresh', expiry_date: 123456, scope: 'scope1 scope2' } };
  } });
  const tokens = await provider.exchange('authorization-code', 'verifier');
  assert.equal(tokens.accessToken, 'access');
  assert.equal(tokens.refreshToken, 'refresh');
  assert.equal(tokens.expiresAt.getTime(), 123456);
  assert.deepEqual(tokens.scopes, ['scope1', 'scope2']);
  provider.client = () => ({ setCredentials: value => assert.deepEqual(value, { refresh_token: 'refresh' }),
    refreshAccessToken: async () => ({ credentials: { access_token: 'new-access' } }) });
  assert.equal((await provider.refresh('access', 'refresh')).refreshToken, 'refresh');
  await assert.rejects(provider.refresh('access'), error => error.reconnect === true);
});

test('YouTube profile preserves hidden or unavailable counters as null', async t => {
  t.mock.method(global, 'fetch', async () => json({ items: [{ ...channel, statistics: { hiddenSubscriberCount: true, subscriberCount: '0' } }] }));
  const profile = await configured().profile('access');
  assert.equal(profile.externalId, 'UCmine');
  assert.equal(profile.username, '@mychannel');
  assert.equal(profile.followers, null);
  assert.equal(profile.posts, null);
  assert.equal(profile.views, null);
});

test('YouTube collection uses owned uploads, daily report headers and genuine period totals', async t => {
  const paths = [];
  t.mock.method(global, 'fetch', async (input, init) => {
    const url = new URL(input); paths.push(url.pathname);
    assert.equal(init.headers.Authorization, 'Bearer private-access');
    assert.ok(!url.href.includes('private-access'));
    assert.ok(init.signal instanceof AbortSignal);
    if (url.pathname.endsWith('/channels')) { assert.equal(url.searchParams.get('mine'), 'true'); return json({ items: [channel] }); }
    if (url.pathname.endsWith('/reports')) {
      assert.equal(url.searchParams.get('ids'), 'channel==UCmine');
      assert.equal(url.searchParams.get('dimensions'), 'day');
      return json({ columnHeaders: [{ name: 'views' }, { name: 'day' }], rows: [[3, '2026-10-25'], [4, '2026-10-26']] });
    }
    if (url.pathname.endsWith('/playlistItems')) { assert.equal(url.searchParams.get('playlistId'), 'UUuploads'); return json({ items: [{ contentDetails: { videoId: 'video1' } }] }); }
    if (url.pathname.endsWith('/videos')) return json({ items: [{ id: 'video1', snippet: { title: 'Launch', channelId: 'UCmine', publishedAt: '2026-10-25T10:00:00Z' }, statistics: { viewCount: '42', commentCount: '0' } }] });
    assert.fail(`Unexpected endpoint ${url.pathname}`);
  });
  const result = await configured().collect('UCmine', 'private-access');
  assert.equal(result.profile.views, 987);
  assert.equal(result.totals.views, 7);
  assert.equal(result.totals.reach, null);
  assert.deepEqual(result.history[0], { date: '2026-10-25', views: 3, reach: null });
  assert.equal(result.media[0].views, 42);
  assert.equal(result.media[0].likes, null);
  assert.equal(result.media[0].comments, 0);
  assert.ok(!paths.some(path => path.includes('search')));
});

test('YouTube collection rejects a stored channel that is not owned by the current grant', async t => {
  t.mock.method(global, 'fetch', async () => json({ items: [channel] }));
  await assert.rejects(configured().collect('UCforeign', 'access'), error => error.code === 'YOUTUBE_CHANNEL_MISMATCH' && error.reconnect);
});

test('YouTube API errors distinguish quota from reconnect and never expose provider payloads', async t => {
  let status = 401;
  t.mock.method(global, 'fetch', async () => json({ error: { message: 'private-access secret-provider-details', errors: [{ reason: status === 403 ? 'quotaExceeded' : 'invalidToken' }] } }, status));
  await assert.rejects(configured().profile('private-access'), error => error.reconnect && !error.message.includes('private-access') && !error.message.includes('secret-provider-details'));
  status = 403;
  await assert.rejects(configured().profile('private-access'), error => error.code === 'YOUTUBE_RATE_LIMITED' && !error.reconnect);
});

test('YouTube revocation sends the token only in POST body and tolerates an already-revoked grant', async t => {
  t.mock.method(global, 'fetch', async (input, init) => {
    assert.equal(input, 'https://oauth2.googleapis.com/revoke');
    assert.equal(init.method, 'POST');
    assert.equal(init.body.get('token'), 'private-token');
    return json({ error: 'invalid_token' }, 400);
  });
  await configured().revoke('private-token');
});
