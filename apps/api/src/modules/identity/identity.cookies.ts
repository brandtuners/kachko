import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

export function identityCookieOptions(config: ConfigService): CookieOptions {
  return { httpOnly: true, secure: config.get('NODE_ENV') === 'production', sameSite: 'lax', path: '/api/v1' };
}
export function setIdentitySession(config: ConfigService, response: Response, session: { token: string; expiresAt: Date }) {
  response.cookie(config.getOrThrow<string>('SESSION_COOKIE_NAME'), session.token, {
    ...identityCookieOptions(config), expires: session.expiresAt,
    maxAge: config.getOrThrow<number>('SESSION_TTL_SECONDS') * 1000,
  });
}
