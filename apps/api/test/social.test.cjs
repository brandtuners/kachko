const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac, randomBytes } = require('node:crypto');
const { ConfigService } = require('@nestjs/config');
const { createDmAutomationSchema, updateDmAutomationSchema } = require('@kachko/validation');
const { SocialService, commentMatches } = require('../dist/modules/social/social.service');
const { SocialController, SocialPublicController, verifyMetaSignature, instagramSignedUser } = require('../dist/modules/social/social.controller');
const { TokenVault } = require('../dist/modules/social/token-vault');

const accountId = '6aa7e550-dba9-46d7-93fb-deb47ae3fb2c';
const automationId = 'd6f0b953-461d-43b7-8e16-dbd98c10c1a1';
const baseInput = { accountId, name: 'Launch', triggerType: 'ALL_POSTS', matchType: 'KEYWORDS', keywords: ['launch'],
  message: 'Here is your link', buttonLabel: 'Open', destinationUrl: 'https://destination.example/' };
const config = new ConfigService({ PUBLIC_APP_URL: 'https://kachko.example', NODE_ENV: 'test', SOCIAL_DM_MONTHLY_LIMIT: 10 });
const connectedAccount = () => ({ id: accountId, userId: 'owner', externalId: '123', platform: 'INSTAGRAM', status: 'CONNECTED',
  accessToken: 'encrypted', tokenExpiresAt: null, user: { isActive: true, deletedAt: null, billingFeatures: ['automations'] } });
const makeService = (db = {}, redis = {}, instagram = {}, vault = { decrypt: value => value }) => new SocialService(db, redis, config, instagram, {}, vault);

test('Meta signature binds exact raw body and invalid deliveries never enter comment processing', async () => {
  const secret = 'server-secret'; const rawBody = Buffer.from('{"object":"instagram","entry":[]}');
  const signature = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  assert.equal(verifyMetaSignature(rawBody, signature, secret), true);
  for (const bad of [undefined, '', 'sha256=no', 'sha256=' + '0'.repeat(64), signature.toUpperCase()]) {
    assert.equal(verifyMetaSignature(rawBody, bad, secret), false);
  }
  assert.equal(verifyMetaSignature(Buffer.from(rawBody.toString() + ' '), signature, secret), false);
  assert.equal(verifyMetaSignature(rawBody, signature, ''), false);
  let received = 0;
  const controller = new SocialPublicController({ receiveComments: async () => received++ }, new ConfigService({ SOCIAL_INSTAGRAM_CLIENT_SECRET: secret }));
  await assert.rejects(controller.receive({ rawBody, body: {}, headers: { 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) } }), error => error.getStatus() === 403);
  assert.equal(received, 0);
  await controller.receive({ rawBody, body: {}, headers: { 'x-hub-signature-256': signature } });
  assert.equal(received, 1);
});

test('Instagram signed requests require valid HMAC, algorithm and string user identity before deletion', async () => {
  const secret = 'meta-secret';
  const sign = payload => {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${createHmac('sha256', secret).update(encoded).digest('base64url')}.${encoded}`;
  };
  const valid = sign({ algorithm: 'HMAC-SHA256', user_id: '12345' });
  assert.equal(instagramSignedUser(valid, secret), '12345');
  for (const invalid of [null, '', 'unsigned', valid + '.extra', sign({ algorithm: 'none', user_id: '12345' }),
    sign({ algorithm: 'HMAC-SHA256', user_id: '../foreign' }), sign({ algorithm: 'HMAC-SHA256', user_id: 12345 }),
    sign({ algorithm: 'HMAC-SHA256' })]) assert.equal(instagramSignedUser(invalid, secret), null);
  assert.equal(instagramSignedUser(valid, 'wrong-secret'), null);
  let deleted;
  const controller = new SocialPublicController({ deleteInstagramData: async id => { deleted = id; return 'confirmation'; } },
    new ConfigService({ SOCIAL_INSTAGRAM_CLIENT_SECRET: secret, PUBLIC_APP_URL: 'https://kachko.example' }));
  await assert.rejects(controller.deleteData({ signed_request: 'forged' }), error => error.getStatus() === 403);
  assert.equal(deleted, undefined);
  const response = await controller.deleteData({ signed_request: valid });
  assert.equal(deleted, '12345');
  assert.equal(response.confirmation_code, 'confirmation');
  assert.equal(new URL(response.url).origin, 'https://kachko.example');
});

test('Instagram data deletion scopes the provider account and confirmation cannot be forged', async () => {
  let where;
  const service = new SocialService({ socialAccount: { deleteMany: async input => { where = input.where; return { count: 1 }; } } }, {},
    new ConfigService({ SOCIAL_INSTAGRAM_CLIENT_SECRET: 'meta-secret' }), {}, {}, {});
  const code = await service.deleteInstagramData('12345');
  assert.deepEqual(where, { platform: 'INSTAGRAM', externalId: '12345' });
  assert.deepEqual(service.deletionStatus(code), { data: { status: 'complete' } });
  const [nonce] = code.split('.');
  assert.throws(() => service.deletionStatus(`${nonce}.${'a'.repeat(43)}`), error => error.getStatus() === 404);
  assert.throws(() => service.deletionStatus('not-a-confirmation'), error => error.getStatus() === 404);
});

test('token vault uses randomized authenticated encryption and rejects tampering or the wrong key', () => {
  const vault = new TokenVault(new ConfigService({ SOCIAL_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') }));
  const first = vault.encrypt('private-provider-token'); const second = vault.encrypt('private-provider-token');
  assert.notEqual(first, second);
  assert.ok(!first.includes('private-provider-token'));
  assert.equal(vault.decrypt(first), 'private-provider-token');
  const parts = first.split('.'); const payload = Buffer.from(parts[3], 'base64url'); payload[0] ^= 1; parts[3] = payload.toString('base64url');
  assert.throws(() => vault.decrypt(parts.join('.')));
  const another = new TokenVault(new ConfigService({ SOCIAL_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') }));
  assert.throws(() => another.decrypt(first));
  assert.throws(() => vault.decrypt('plaintext-private-provider-token'));
  assert.throws(() => new TokenVault(new ConfigService({})).encrypt('token'));
});

test('DM automation contracts reject unsafe payloads and PATCH never injects creation defaults', () => {
  assert.equal(createDmAutomationSchema.safeParse(baseInput).success, true);
  for (const patch of [{ destinationUrl: 'javascript:alert(1)' }, { triggerType: 'SPECIFIC_POST', mediaId: null },
    { matchType: 'KEYWORDS', keywords: [] }, { keywords: Array(21).fill('launch') }, { message: 'x'.repeat(901) },
    { buttonLabel: 'x'.repeat(21) }, { userId: 'foreign' }]) {
    assert.equal(createDmAutomationSchema.safeParse({ ...baseInput, ...patch }).success, false);
  }
  assert.equal(updateDmAutomationSchema.safeParse({}).success, false);
  assert.deepEqual(updateDmAutomationSchema.parse({ name: 'Renamed' }), { name: 'Renamed' });
  assert.deepEqual(updateDmAutomationSchema.parse({ isActive: false }), { isActive: false });
});

test('comment matching normalizes Unicode/case and never treats comment text as a pattern', () => {
  assert.equal(commentMatches('ANY', [], ''), true);
  assert.equal(commentMatches('KEYWORDS', ['sale'], 'Please send ＳＡＬＥ details'), true);
  assert.equal(commentMatches('KEYWORDS', ['café'], 'Please show CAFÉ'), true);
  assert.equal(commentMatches('KEYWORDS', ['a.b'], 'aXb'), false);
  assert.equal(commentMatches('KEYWORDS', ['launch'], 'different topic'), false);
  assert.equal(commentMatches('KEYWORDS', [], 'launch'), false);
});

test('social OAuth state is browser-bound, provider-bound and consumed before token exchange', async () => {
  const state = 'a'.repeat(43); let reads = 0; let exchanges = 0;
  let stored = JSON.stringify({ userId: 'owner', providerName: 'instagram', verifier: 'server-verifier' });
  const redis = { client: { isReady: true, withCommandOptions: () => ({ getDel: async () => { reads++; const value = stored; stored = null; return value; } }) } };
  const service = makeService({}, redis, { exchange: async () => { exchanges++; throw new Error('Provider rejects code'); } });
  await assert.rejects(service.callback('instagram', state, 'b'.repeat(43), 'code'), error => error.getStatus() === 403);
  assert.equal(reads, 0); assert.equal(exchanges, 0);
  await assert.rejects(service.callback('youtube', state, state, 'code'), error => error.getStatus() === 403);
  assert.equal(reads, 1); assert.equal(exchanges, 0);
  stored = JSON.stringify({ userId: 'owner', providerName: 'instagram', verifier: 'server-verifier' });
  await assert.rejects(service.callback('instagram', state, state, 'code'), /Provider rejects code/);
  assert.equal(exchanges, 1);
  await assert.rejects(service.callback('instagram', state, state, 'code'), error => error.getStatus() === 403);
  assert.equal(exchanges, 1);
});

test('social account reads/disconnect and automation edits/deletes are owner-scoped', async () => {
  const accountQueries = []; const automationQueries = []; const deleteQueries = [];
  const service = makeService({ socialAccount: { findFirst: async input => { accountQueries.push(input.where); return null; } },
    dmAutomation: { findFirst: async input => { automationQueries.push(input.where); return null; },
      updateMany: async input => { deleteQueries.push(input.where); return { count: 0 }; } } });
  for (const job of [() => service.media('foreign', accountId), () => service.analytics('foreign', accountId, '30d'),
    () => service.disconnect('foreign', accountId), () => service.sync('foreign', accountId),
    () => service.updateAutomation('foreign', automationId, { isActive: false }), () => service.deleteAutomation('foreign', automationId)]) {
    await assert.rejects(job(), error => error.getStatus() === 404);
  }
  assert.ok(accountQueries.every(query => query.userId === 'foreign' && query.id === accountId));
  assert.equal(automationQueries[0].account.userId, 'foreign');
  assert.equal(deleteQueries[0].account.userId, 'foreign');
});

test('DM creation rejects non-Instagram accounts and posts outside the connected account', async () => {
  let account = { ...connectedAccount(), platform: 'YOUTUBE' };
  const service = makeService({ socialAccount: { findFirst: async () => account }, socialMedia: { findUnique: async input => {
    assert.deepEqual(input.where, { accountId_externalId: { accountId, externalId: '999' } }); return null;
  } } });
  await assert.rejects(service.createAutomation('owner', createDmAutomationSchema.parse(baseInput)), error => error.getResponse().code === 'INSTAGRAM_REQUIRED');
  account = connectedAccount();
  await assert.rejects(service.createAutomation('owner', createDmAutomationSchema.parse({ ...baseInput, triggerType: 'SPECIFIC_POST', mediaId: '999' })),
    error => error.getResponse().code === 'MEDIA_NOT_FOUND');
});

test('partial automation updates preserve keywords, disabled state and NEXT_POST binding', async () => {
  const stored = { ...createDmAutomationSchema.parse({ ...baseInput, triggerType: 'NEXT_POST', isActive: false }), id: automationId,
    createdAt: new Date(), updatedAt: new Date(), deletedAt: null, triggerStartedAt: new Date(), mediaId: '777' };
  let update;
  const service = makeService({ socialAccount: { findFirst: async () => connectedAccount() }, dmAutomation: {
    findFirst: async () => stored, update: async input => { update = input.data; return { ...stored, ...input.data }; },
  } });
  await service.updateAutomation('owner', automationId, updateDmAutomationSchema.parse({ name: 'Renamed' }));
  assert.deepEqual(update.keywords, ['launch']);
  assert.equal(update.isActive, false);
  assert.equal(update.mediaId, '777');
  assert.equal('triggerStartedAt' in update, false);
});

test('social endpoints gate paid actions while downgrade still permits pausing/deleting', () => {
  let writes = 0;
  const controller = new SocialController({ updateAutomation: () => ++writes, deleteAutomation: () => ++writes,
    createAutomation: () => ++writes, analytics: () => ++writes }, config);
  const free = { identity: { id: 'owner' }, entitlements: { features: [] } };
  assert.throws(() => controller.create(free, baseInput), error => error.getStatus() === 403);
  assert.throws(() => controller.analytics(free, accountId, { range: '30d' }), error => error.getStatus() === 403);
  assert.throws(() => controller.update(free, automationId, { isActive: true }), error => error.getStatus() === 403);
  assert.throws(() => controller.update(free, automationId, { isActive: false, message: 'changed' }), error => error.getStatus() === 403);
  assert.equal(writes, 0);
  controller.update(free, automationId, updateDmAutomationSchema.parse({ isActive: false }));
  controller.delete(free, automationId);
  assert.equal(writes, 2);
  controller.create({ ...free, entitlements: { features: ['automations'] } }, baseInput);
  controller.analytics({ ...free, entitlements: { features: ['advanced_analytics'] } }, accountId, { range: '30d' });
  assert.equal(writes, 4);
});

function deliveryFixture() {
  return { id: 'delivery', accountId, commentId: '999', status: 'PENDING', commentCreatedAt: new Date(),
    account: connectedAccount(), automation: { isActive: true, accountId }, clickToken: 'c'.repeat(43),
    message: 'Here is your link', buttonLabel: 'Open', destinationUrl: 'https://destination.example/', publicReply: null };
}
function deliveryService(item, monthSends = 0, send = async () => assert.fail('This delivery cannot send')) {
  const writes = []; let counts = 0;
  const tx = { $queryRaw: async () => [], dmDelivery: { findUnique: async () => item,
    count: async input => { assert.ok(input.where.status.in.includes('UNKNOWN')); return counts++ === 0 ? monthSends : 0; },
    update: async input => { writes.push(input.data); return { ...item, ...input.data }; } } };
  const db = { $transaction: async callback => callback(tx), dmDelivery: { update: tx.dmDelivery.update,
    updateMany: async input => { writes.push(input.data); return { count: 1 }; } }, socialAccount: { updateMany: async input => { writes.push(input.data); return { count: 1 }; } } };
  return { service: makeService(db, {}, { sendPrivateReply: send }), writes };
}

test('queued DM delivery rechecks downgrade, disabled rule, account identity, suspension and comment expiry', async () => {
  const cases = [item => { item.account.user.billingFeatures = []; }, item => { item.automation.isActive = false; },
    item => { item.automation.accountId = 'different-account'; }, item => { item.account.status = 'DISCONNECTING'; },
    item => { item.account.user.isActive = false; }, item => { item.account.user.deletedAt = new Date(); },
    item => { item.commentCreatedAt = new Date(Date.now() - 8 * 86_400_000); }];
  const codes = ['PLAN_REQUIRED', 'AUTOMATION_PAUSED', 'AUTOMATION_MOVED', 'ACCOUNT_RECONNECT_REQUIRED', 'OWNER_INACTIVE', 'OWNER_INACTIVE', 'COMMENT_EXPIRED'];
  for (const [index, change] of cases.entries()) {
    const item = deliveryFixture(); change(item); const { service, writes } = deliveryService(item);
    await service.sendDelivery(item.id);
    assert.deepEqual(writes, [{ status: 'SKIPPED', errorCode: codes[index] }]);
  }
});

test('queued DM quota includes ambiguous sends and expired credentials never invoke Meta', async () => {
  let item = deliveryFixture(); let fixture = deliveryService(item, 10);
  await fixture.service.sendDelivery(item.id);
  assert.deepEqual(fixture.writes, [{ status: 'SKIPPED', errorCode: 'MONTHLY_LIMIT' }]);
  item = deliveryFixture(); item.account.tokenExpiresAt = new Date(Date.now() - 1000); fixture = deliveryService(item);
  await fixture.service.sendDelivery(item.id);
  assert.equal(fixture.writes[0].status, 'SENDING');
  assert.ok(fixture.writes.some(write => write.status === 'FAILED' && write.errorCode === 'TOKEN_EXPIRED'));
  assert.ok(fixture.writes.some(write => write.status === 'RECONNECT_REQUIRED'));
});

test('unconfirmed DM sends are never retried automatically', async () => {
  const item = deliveryFixture(); let sends = 0;
  const fixture = deliveryService(item, 0, async () => { sends++; throw new Error('Connection lost after request'); });
  await fixture.service.sendDelivery(item.id);
  assert.equal(sends, 1);
  assert.ok(fixture.writes.some(write => write.status === 'UNKNOWN'));
  item.status = 'UNKNOWN';
  await fixture.service.sendDelivery(item.id);
  assert.equal(sends, 1);
});

test('duplicate webhook comments retain one durable event and ignore self-comments', async () => {
  const events = new Map(); let inserts = 0;
  const service = makeService({ socialAccount: { findUnique: async () => connectedAccount() }, socialCommentEvent: { createMany: async input => {
    inserts++; assert.equal(input.skipDuplicates, true);
    for (const row of input.data) {
      const key = `${row.accountId}:${row.commentId}`;
      if (!events.has(key)) events.set(key, row);
    }
  } } });
  const payload = { object: 'instagram', entry: [{ id: '123', time: Math.floor(Date.now() / 1000), changes: [{ field: 'comments',
    value: { id: '999', media: { id: '888' }, from: { id: '456' }, text: 'launch please' } }] }] };
  await service.receiveComments(payload); await service.receiveComments(payload);
  assert.equal(inserts, 2); assert.equal(events.size, 1);
  payload.entry[0].changes[0].value.from.id = '123';
  await service.receiveComments(payload);
  assert.equal(inserts, 2);
});
