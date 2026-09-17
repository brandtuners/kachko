import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { IdentityUser, UsernameResponse } from '@kachko/types';
import { RESERVED_USERNAMES, type RegisterInput, type LoginInput, type ProfileInput,
  type PasswordResetRequestInput, type PasswordResetConfirmInput } from '@kachko/validation';
import { IdentityRepository } from './identity.repository';
import { PasswordResetMailer } from './password-reset.mailer';

export function identityError(status: number, code: string, message: string): never {
  throw new HttpException({ code, message }, status);
}
export const tokenDigest = (token: string) => createHash('sha256').update(token).digest('hex');
const passwordOptions = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const safeUser = (user: IdentityUser): IdentityUser => ({
  id: user.id, email: user.email, username: user.username, displayName: user.displayName,
  bio: user.bio, avatarUrl: user.avatarUrl,
});
const isUniqueError = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

@Injectable()
export class IdentityService {
  private dummyHash?: Promise<string>;
  constructor(private readonly repository: IdentityRepository, private readonly config: ConfigService,
    private readonly mailer: PasswordResetMailer) {}

  private newSession() {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.getOrThrow<number>('SESSION_TTL_SECONDS') * 1000);
    return { token, expiresAt, tokenHash: tokenDigest(token) };
  }
  async register(input: RegisterInput, previous?: string) {
    const passwordHash = await hash(input.password, passwordOptions);
    const session = this.newSession();
    try {
      const user = await this.repository.register({ email: input.email, username: input.username,
        displayName: input.displayName, passwordHash }, session.tokenHash, session.expiresAt, previous && tokenDigest(previous));
      return { user: safeUser(user), ...session };
    } catch (error) {
      if (isUniqueError(error)) identityError(409, 'ACCOUNT_UNAVAILABLE', 'Email or username is unavailable');
      throw error;
    }
  }
  async googleLogin(subject: string, previous?: string) {
    const account = await this.repository.findGoogle(subject);
    if (!account) return null;
    if (!account.user.isActive || account.user.deletedAt) identityError(401, 'INVALID_CREDENTIALS', 'Unable to sign in');
    const session = this.newSession();
    await this.repository.createSession(account.userId, session.tokenHash, session.expiresAt, previous && tokenDigest(previous));
    return { user: safeUser(account.user), ...session };
  }
  async googleRegister(profile: { subject: string; email: string }, input: { username: string; displayName?: string }, previous?: string) {
    const session = this.newSession();
    try {
      const user = await this.repository.register({ email: profile.email, username: input.username,
        displayName: input.displayName, isVerified: true, googleAccount: { create: { subject: profile.subject } } },
        session.tokenHash, session.expiresAt, previous && tokenDigest(previous));
      return { user: safeUser(user), ...session };
    } catch (error) {
      if (isUniqueError(error)) identityError(409, 'ACCOUNT_UNAVAILABLE', 'Email, username or Google account is unavailable; restart Google sign-in');
      throw error;
    }
  }
  async login(input: LoginInput, previous?: string) {
    const user = await this.repository.findByEmail(input.email);
    // Unknown accounts still perform a real password verification.
    const encoded = user?.passwordHash ?? await (this.dummyHash ??= hash(randomBytes(32), passwordOptions));
    const valid = await verify(encoded, input.password);
    if (!valid || !user?.passwordHash || !user.isActive || user.deletedAt) {
      identityError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    const session = this.newSession();
    await this.repository.createSession(user.id, session.tokenHash, session.expiresAt, previous && tokenDigest(previous));
    return { user: safeUser(user), ...session };
  }
  async authenticate(token?: string): Promise<IdentityUser> {
    if (!token) identityError(401, 'UNAUTHENTICATED', 'Sign in to continue');
    const session = await this.repository.findSession(tokenDigest(token));
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now() ||
        !session.user.isActive || session.user.deletedAt) identityError(401, 'UNAUTHENTICATED', 'Sign in to continue');
    if (!session.lastUsedAt || Date.now() - session.lastUsedAt.getTime() > 60_000) {
      await this.repository.touchSession(session.id);
    }
    return safeUser(session.user);
  }
  async logout(token?: string) {
    if (token) await this.repository.revokeSession(tokenDigest(token));
    return { data: { loggedOut: true as const } };
  }
  async requestPasswordReset(input: PasswordResetRequestInput) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.getOrThrow<number>('PASSWORD_RESET_TTL_SECONDS') * 1000);
    const account = await this.repository.createPasswordReset(input.email, tokenDigest(token), expiresAt);
    // Keep the response indistinguishable for known/unknown accounts and for
    // provider outages. The mailer records delivery failures for operators.
    if (account) await this.mailer.send(account.email, token).catch(() => undefined);
    return { data: { accepted: true as const } };
  }
  async confirmPasswordReset(input: PasswordResetConfirmInput) {
    const passwordHash = await hash(input.password, passwordOptions);
    if (!await this.repository.resetPassword(tokenDigest(input.token), passwordHash)) {
      identityError(400, 'RESET_TOKEN_INVALID', 'This password reset link is invalid or expired');
    }
    return { data: { reset: true as const } };
  }
  async availability(username: string): Promise<UsernameResponse> {
    if ((RESERVED_USERNAMES as readonly string[]).includes(username)) {
      return { data: { username, available: false, reason: 'reserved' } };
    }
    const exists = await this.repository.findByUsername(username);
    return { data: { username, available: !exists, ...(exists ? { reason: 'taken' as const } : {}) } };
  }
  async updateProfile(userId: string, input: ProfileInput) {
    try { return { data: safeUser(await this.repository.updateProfile(userId, input)) }; }
    catch (error) {
      if (isUniqueError(error)) identityError(409, 'USERNAME_UNAVAILABLE', 'Username is unavailable');
      throw error;
    }
  }
}
