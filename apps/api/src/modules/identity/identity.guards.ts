import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { IdentityUser } from '@kachko/types';
import { RedisService } from '../../redis/redis.service';
import { IdentityService, identityError, tokenDigest } from './identity.service';

export type IdentityRequest = Request & { identity: IdentityUser };
export const RatePolicy = (name: string, limit: number, seconds: number) => SetMetadata('identityRate', { name, limit, seconds });

export function sessionCookie(request: Request, config: ConfigService): string | undefined {
  const name = config.getOrThrow<string>('SESSION_COOKIE_NAME');
  const values = (request.headers.cookie ?? '').split(';').map(part => part.trim())
    .filter(part => part.startsWith(`${name}=`)).map(part => part.slice(name.length + 1));
  // Reject ambiguous or malformed cookies instead of authenticating with a guessed value.
  return values.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(values[0]!) ? values[0] : undefined;
}

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    const origin = request.headers.origin;
    if (request.headers['x-kachko-csrf'] !== '1' ||
        (origin !== undefined && !this.config.getOrThrow<string[]>('CORS_ORIGINS').includes(origin))) {
      identityError(403, 'CSRF_REJECTED', 'Send X-Kachko-CSRF: 1 from an allowed origin');
    }
    // Custom header requires CORS preflight; non-browser clients may omit Origin.
    return true;
  }
}

const incrementScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return {count, redis.call('TTL', KEYS[1])}
`;
@Injectable()
export class IdentityRateGuard implements CanActivate {
  constructor(private readonly redis: RedisService, private readonly config: ConfigService, private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    const policy = this.reflector.getAllAndOverride<{ name: string; limit: number; seconds: number }>('identityRate', [context.getHandler(), context.getClass()])
      ?? { name: 'identity', limit: 60, seconds: 60 };
    let result: number[];
    try {
      if (!this.redis.client.isReady) throw new Error('Redis unavailable');
      result = await this.redis.client.withCommandOptions({
        abortSignal: AbortSignal.timeout(this.config.getOrThrow<number>('DEPENDENCY_TIMEOUT_MS')),
      }).eval(incrementScript, {
        keys: [`rate:${policy.name}:${tokenDigest(request.ip ?? request.socket.remoteAddress ?? 'unknown')}`],
        arguments: [String(policy.seconds)],
      }) as number[];
    } catch {
      identityError(503, 'DEPENDENCIES_UNAVAILABLE', 'Required services are unavailable');
    }
    if (result[0]! > policy.limit) {
      response.setHeader('Retry-After', String(Math.max(1, result[1]!)));
      identityError(429, 'RATE_LIMITED', 'Too many requests; try again later');
    }
    return true;
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly identity: IdentityService, private readonly config: ConfigService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<IdentityRequest>();
    request.identity = await this.identity.authenticate(sessionCookie(request, this.config));
    return true;
  }
}
