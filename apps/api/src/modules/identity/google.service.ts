import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { GoogleRegistrationInput } from '@kachko/validation';
import { RedisService } from '../../redis/redis.service';
import { GoogleProvider, type GoogleProfile } from './google.provider';
import { IdentityService, identityError, tokenDigest } from './identity.service';
import { IdentityRepository } from './identity.repository';

export const GOOGLE_FLOW_TTL = 600;
const randomToken = () => randomBytes(32).toString('base64url');
const validToken = (value?: string) => Boolean(value && /^[A-Za-z0-9_-]{43}$/.test(value));
@Injectable()
export class GoogleService {
  constructor(private readonly provider: GoogleProvider, private readonly redis: RedisService,
    private readonly config: ConfigService, private readonly identity: IdentityService, private readonly repository: IdentityRepository) {}
  private async store(key: string, value: unknown) {
    try {
      if (!this.redis.client.isReady) throw new Error('Redis unavailable');
      await this.redis.client.withCommandOptions({ abortSignal: AbortSignal.timeout(this.config.getOrThrow<number>('DEPENDENCY_TIMEOUT_MS')) })
        .set(key, JSON.stringify(value), { EX: GOOGLE_FLOW_TTL });
    } catch { identityError(503, 'DEPENDENCIES_UNAVAILABLE', 'Required services are unavailable'); }
  }
  private async read(key: string, consume: boolean): Promise<string | null> {
    try {
      if (!this.redis.client.isReady) throw new Error('Redis unavailable');
      const client = this.redis.client.withCommandOptions({ abortSignal: AbortSignal.timeout(this.config.getOrThrow<number>('DEPENDENCY_TIMEOUT_MS')) });
      return consume ? await client.getDel(key) : await client.get(key);
    } catch { identityError(503, 'DEPENDENCIES_UNAVAILABLE', 'Required services are unavailable'); }
  }
  async start() {
    this.provider.assertEnabled();
    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken();
    const url = this.provider.authorizationUrl(state, nonce, createHash('sha256').update(verifier).digest('base64url'));
    await this.store(`google:state:${tokenDigest(state)}`, { nonce, verifier });
    return { state, url };
  }
  async callback(state: string | undefined, cookieState: string | undefined, code?: string, denied?: string, previous?: string) {
    if (!validToken(state) || state !== cookieState) identityError(403, 'GOOGLE_STATE_INVALID', 'Google sign-in expired or is invalid; start again');
    const raw = await this.read(`google:state:${tokenDigest(state!)}`, true);
    if (!raw) identityError(403, 'GOOGLE_STATE_INVALID', 'Google sign-in expired or was already used; start again');
    if (denied || !code || code.length > 4096) identityError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in was not completed');
    const { verifier, nonce } = JSON.parse(raw) as { verifier: string; nonce: string };
    const profile = await this.provider.exchange(code, verifier, nonce);
    const session = await this.identity.googleLogin(profile.subject, previous);
    if (session) return { session };
    if (await this.repository.findByEmail(profile.email)) {
      identityError(409, 'ACCOUNT_LINK_REQUIRED', 'Sign in using your existing method; Google account linking is not yet supported');
    }
    const pending = randomToken();
    await this.store(`google:pending:${tokenDigest(pending)}`, profile);
    return { pending };
  }
  async pending(token?: string, consume = false): Promise<GoogleProfile> {
    if (!validToken(token)) identityError(401, 'GOOGLE_ONBOARDING_EXPIRED', 'Restart Google sign-in');
    const raw = await this.read(`google:pending:${tokenDigest(token!)}`, consume);
    if (!raw) identityError(401, 'GOOGLE_ONBOARDING_EXPIRED', 'Restart Google sign-in');
    return JSON.parse(raw) as GoogleProfile;
  }
  async complete(token: string | undefined, input: GoogleRegistrationInput, previous?: string) {
    const profile = await this.pending(token, true);
    return this.identity.googleRegister(profile, input, previous);
  }
}
