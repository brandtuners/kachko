import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { emailSchema } from '@kachko/validation';
import { identityError } from './identity.service';

export interface GoogleProfile { subject: string; email: string }
@Injectable()
export class GoogleProvider {
  private readonly client: OAuth2Client;
  constructor(private readonly config: ConfigService) {
    this.client = new OAuth2Client({
      clientId: config.get<string>('GOOGLE_CLIENT_ID'), clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET'),
      redirectUri: config.get<string>('GOOGLE_REDIRECT_URI'), transporterOptions: { timeout: 5000, retry: false },
    });
  }
  assertEnabled() {
    if (!this.config.get<string>('GOOGLE_CLIENT_ID')) identityError(503, 'GOOGLE_NOT_CONFIGURED', 'Google login is not configured');
  }
  authorizationUrl(state: string, nonce: string, challenge: string) {
    this.assertEnabled();
    const url = new URL(this.client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'], state, code_challenge: challenge,
      code_challenge_method: CodeChallengeMethod.S256, prompt: 'select_account',
    }));
    url.searchParams.set('nonce', nonce);
    return url.toString();
  }
  async exchange(code: string, verifier: string, nonce: string): Promise<GoogleProfile> {
    this.assertEnabled();
    try {
      const { tokens } = await this.client.getToken({ code, codeVerifier: verifier });
      if (!tokens.id_token) throw new Error('No ID token');
      // Google's SDK verifies the signature, issuer, audience and token lifetime.
      const ticket = await this.client.verifyIdToken({ idToken: tokens.id_token, audience: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID') });
      const payload = ticket.getPayload() as (ReturnType<typeof ticket.getPayload> & { nonce?: string });
      const email = emailSchema.safeParse(payload?.email);
      if (!payload || payload.nonce !== nonce || payload.email_verified !== true ||
          !payload.sub || payload.sub.length > 255 || !email.success) throw new Error('Invalid Google identity');
      // Access/refresh/ID tokens are neither stored nor returned to the browser.
      return { subject: payload.sub, email: email.data };
    } catch {
      identityError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in failed; start again');
    }
  }
}
