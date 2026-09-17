const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { ConfigService } = require('@nestjs/config');
const { IdentityService } = require('../dist/modules/identity/identity.service');
const { StaffGuard, AdminGuard } = require('../dist/modules/moderation/moderation.guard');

test('password reset request stays generic and confirm rejects consumed tokens', async () => {
  let delivered;
  const repository = {
    createPasswordReset: async (email, digest) => ({ email, digest }),
    resetPassword: async () => false,
  };
  const mailer = { send: async (email, token) => { delivered = { email, token }; } };
  const config = new ConfigService({ SESSION_TTL_SECONDS: 600, PASSWORD_RESET_TTL_SECONDS: 3600 });
  const service = new IdentityService(repository, config, mailer);
  assert.deepEqual(await service.requestPasswordReset({ email: 'user@example.com' }), { data: { accepted: true } });
  assert.equal(delivered.email, 'user@example.com');
  assert.match(delivered.token, /^[A-Za-z0-9_-]{43}$/);
  await assert.rejects(service.confirmPasswordReset({ token: delivered.token, password: 'new-password-123' }), error => error.getStatus() === 400);
});

function context(id = 'user-1') {
  return { switchToHttp: () => ({ getRequest: () => ({ identity: { id } }) }) };
}

test('staff and admin guards enforce persisted roles', async () => {
  let role = 'USER';
  const prisma = { user: { findUnique: async () => ({ role, isActive: true, deletedAt: null }) } };
  const staff = new StaffGuard(prisma);
  const admin = new AdminGuard(prisma);
  await assert.rejects(staff.canActivate(context()), error => error.getStatus() === 403);
  role = 'MODERATOR';
  assert.equal(await staff.canActivate(context()), true);
  await assert.rejects(admin.canActivate(context()), error => error.getStatus() === 403);
  role = 'ADMIN';
  assert.equal(await admin.canActivate(context()), true);
});
