import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z, createDmAutomationSchema, updateDmAutomationSchema, socialProviderSchema, socialAccountIdSchema,
  socialAnalyticsQuerySchema, type CreateDmAutomationInput, type UpdateDmAutomationInput } from '@kachko/validation';
import { KACHKO_FEATURES } from '@kachko/types';
import { IdentityValidationPipe } from '../identity/identity.controller';
import { IdentityRateGuard, SessionGuard, RatePolicy, SkipCsrf, type IdentityRequest } from '../identity/identity.guards';
import { identityError } from '../identity/identity.service';
import { SocialService } from './social.service';

const idPipe = new IdentityValidationPipe(socialAccountIdSchema);
const cookieName = (provider: string) => `kachko_social_${provider}_state`;
const scalar = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;
export function verifyMetaSignature(body: Buffer, signature: unknown, secret: string) {
  if (!secret || typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}
export function instagramSignedUser(signedRequest: unknown, secret: string): string | null {
  if (!secret || typeof signedRequest !== 'string') return null;
  const parts = signedRequest.split('.');
  if (parts.length !== 2 || !parts.every(value => /^[A-Za-z0-9_-]+$/.test(value))) return null;
  const signature = Buffer.from(parts[0]!, 'base64url');
  const expected = createHmac('sha256', secret).update(parts[1]!).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as { algorithm?: string; user_id?: string };
    return payload.algorithm === 'HMAC-SHA256' && typeof payload.user_id === 'string' && /^\d{1,50}$/.test(payload.user_id) ? payload.user_id : null;
  } catch { return null; }
}
function requireAutomations(request: IdentityRequest) {
  if (!request.entitlements.features.includes(KACHKO_FEATURES.AUTOMATIONS)) identityError(403, 'FEATURE_REQUIRED', 'Instagram auto-replies require the automations feature');
}

@Controller('social')
@UseGuards(IdentityRateGuard, SessionGuard)
@RatePolicy('social', 60, 60)
export class SocialController {
  constructor(private readonly social: SocialService, private readonly config: ConfigService) {}
  @Get('status') status() { return this.social.status(); }
  @Get('accounts') accounts(@Req() request: IdentityRequest) { return this.social.accounts(request.identity.id); }
  @Post('connect/:provider')
  @RatePolicy('social-connect', 10, 60)
  async connect(@Req() request: IdentityRequest, @Param('provider', new IdentityValidationPipe(socialProviderSchema)) provider: string,
    @Res({ passthrough: true }) response: Response) {
    const result = await this.social.connect(request.identity.id, provider);
    response.cookie(cookieName(provider), result.state, { httpOnly: true, secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax', path: '/', maxAge: 600_000 });
    return { data: { url: result.url } };
  }
  @Delete('accounts/:id')
  disconnect(@Req() request: IdentityRequest, @Param('id', idPipe) id: string) { return this.social.disconnect(request.identity.id, id); }
  @Post('accounts/:id/sync')
  @HttpCode(200)
  @RatePolicy('social-sync', 6, 60)
  sync(@Req() request: IdentityRequest, @Param('id', idPipe) id: string) { return this.social.sync(request.identity.id, id); }
  @Get('accounts/:id/analytics')
  analytics(@Req() request: IdentityRequest, @Param('id', idPipe) id: string,
    @Query(new IdentityValidationPipe(socialAnalyticsQuerySchema)) query: { range: string }) {
    if (!request.entitlements.features.includes(KACHKO_FEATURES.ADVANCED_ANALYTICS)) identityError(403, 'FEATURE_REQUIRED', 'Social analytics require the advanced_analytics feature');
    return this.social.analytics(request.identity.id, id, query.range);
  }
  @Get('accounts/:id/media')
  media(@Req() request: IdentityRequest, @Param('id', idPipe) id: string) {
    return this.social.media(request.identity.id, id, request.entitlements.features.includes(KACHKO_FEATURES.ADVANCED_ANALYTICS));
  }
  @Get('automations') automations(@Req() request: IdentityRequest) { return this.social.automations(request.identity.id); }
  @Get('usage') usage(@Req() request: IdentityRequest) { return this.social.usage(request.identity.id); }
  @Get('automations/:id/deliveries')
  deliveries(@Req() request: IdentityRequest, @Param('id', idPipe) id: string,
    @Query(new IdentityValidationPipe(z.strictObject({ cursor: z.uuid().optional() }))) query: { cursor?: string }) {
    return this.social.deliveries(request.identity.id, id, query.cursor);
  }
  @Post('deliveries/:id/retry')
  @HttpCode(200)
  @RatePolicy('social-retry', 10, 60)
  retry(@Req() request: IdentityRequest, @Param('id', idPipe) id: string) {
    requireAutomations(request);
    return this.social.retryDelivery(request.identity.id, id);
  }
  @Post('automations')
  create(@Req() request: IdentityRequest, @Body(new IdentityValidationPipe(createDmAutomationSchema)) input: CreateDmAutomationInput) {
    requireAutomations(request); return this.social.createAutomation(request.identity.id, input);
  }
  @Patch('automations/:id')
  update(@Req() request: IdentityRequest, @Param('id', idPipe) id: string,
    @Body(new IdentityValidationPipe(updateDmAutomationSchema)) input: UpdateDmAutomationInput) {
    if (Object.keys(input).some(key => key !== 'isActive') || input.isActive) requireAutomations(request);
    return this.social.updateAutomation(request.identity.id, id, input);
  }
  @Delete('automations/:id')
  delete(@Req() request: IdentityRequest, @Param('id', idPipe) id: string) { return this.social.deleteAutomation(request.identity.id, id); }
}

@Controller('social')
export class SocialPublicController {
  constructor(private readonly social: SocialService, private readonly config: ConfigService) {}
  @Get('callback/:provider')
  @UseGuards(IdentityRateGuard)
  @RatePolicy('social-callback', 20, 60)
  async callback(@Param('provider', new IdentityValidationPipe(socialProviderSchema)) provider: string,
    @Query() query: Record<string, unknown>, @Req() request: Request, @Res() response: Response) {
    const name = cookieName(provider);
    const values = (request.headers.cookie ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith(`${name}=`));
    const stateCookie = values.length === 1 ? values[0]!.slice(name.length + 1) : undefined;
    response.clearCookie(name, { path: '/', httpOnly: true, sameSite: 'lax', secure: this.config.get<string>('NODE_ENV') === 'production' });
    const url = new URL('/dashboard/social', this.config.getOrThrow<string>('PUBLIC_APP_URL'));
    try {
      await this.social.callback(provider, scalar(query.state) ?? '', stateCookie, scalar(query.code));
      url.searchParams.set('connected', provider);
    } catch { url.searchParams.set('error', 'connection_failed'); }
    return response.redirect(302, url.href);
  }
  @Get('dm/:token')
  @UseGuards(IdentityRateGuard)
  @RatePolicy('dm-clicks', 120, 60)
  async dm(@Param('token') token: string, @Res() response: Response) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) identityError(404, 'LINK_NOT_FOUND', 'Link not found');
    response.setHeader('Cache-Control', 'private, no-store');
    return response.redirect(302, await this.social.dmDestination(token));
  }
  @Get('webhooks/instagram')
  challenge(@Query() query: Record<string, unknown>, @Res() response: Response) {
    const expected = this.config.get<string>('SOCIAL_INSTAGRAM_WEBHOOK_VERIFY_TOKEN');
    if (!expected || query['hub.mode'] !== 'subscribe' || query['hub.verify_token'] !== expected || typeof query['hub.challenge'] !== 'string') {
      identityError(403, 'WEBHOOK_REJECTED', 'Webhook verification failed');
    }
    return response.type('text/plain').send(query['hub.challenge']);
  }
  @Post('webhooks/instagram')
  @HttpCode(200)
  @SkipCsrf()
  async receive(@Req() request: RawBodyRequest<Request>) {
    const secret = this.config.get<string>('SOCIAL_INSTAGRAM_CLIENT_SECRET') ?? '';
    if (!request.rawBody || !verifyMetaSignature(request.rawBody, request.headers['x-hub-signature-256'], secret)) {
      identityError(403, 'WEBHOOK_REJECTED', 'Webhook signature is invalid');
    }
    await this.social.receiveComments(request.body);
    return { received: true };
  }
  @Post('deauthorize/instagram')
  @HttpCode(200)
  @SkipCsrf()
  async deauthorize(@Body() body: { signed_request?: unknown }) {
    const secret = this.config.get<string>('SOCIAL_INSTAGRAM_CLIENT_SECRET') ?? '';
    const userId = instagramSignedUser(body?.signed_request, secret);
    if (!userId) identityError(403, 'WEBHOOK_REJECTED', 'Invalid signed request');
    await this.social.deleteInstagramData(userId);
    return { deleted: true };
  }
  @Post('data-deletion/instagram')
  @HttpCode(200)
  @SkipCsrf()
  async deleteData(@Body() body: { signed_request?: unknown }) {
    const secret = this.config.get<string>('SOCIAL_INSTAGRAM_CLIENT_SECRET') ?? '';
    const userId = instagramSignedUser(body?.signed_request, secret);
    if (!userId) identityError(403, 'WEBHOOK_REJECTED', 'Invalid signed request');
    const confirmation = await this.social.deleteInstagramData(userId);
    const url = new URL('/social-data-deletion', this.config.getOrThrow<string>('PUBLIC_APP_URL'));
    url.searchParams.set('code', confirmation);
    return { url: url.href, confirmation_code: confirmation };
  }
  @Get('deletion-status/:code')
  deletionStatus(@Param('code') code: string) {
    return this.social.deletionStatus(code);
  }
}
