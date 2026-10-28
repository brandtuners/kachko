import { BadRequestException, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { verifyWebhook } from '@clerk/backend/webhooks';
import { SkipCsrf } from './identity.guards';
import { ClerkIdentityService } from './clerk-identity.service';

@Controller('webhooks')
export class ClerkWebhookController {
  constructor(private readonly clerk: ClerkIdentityService, private readonly config: ConfigService) {}

  @Post('clerk')
  @HttpCode(200)
  @SkipCsrf()
  async receive(@Req() request: RawBodyRequest<Request>) {
    const signingSecret = this.config.get<string>('CLERK_WEBHOOK_SIGNING_SECRET');
    if (!signingSecret || !request.rawBody) throw new BadRequestException('Webhook verification is unavailable');
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(',') : value);
    }
    const url = `${request.protocol}://${request.get('host')}${request.originalUrl}`;
    let event;
    try {
      event = await verifyWebhook(new globalThis.Request(url, { method: 'POST', headers, body: request.rawBody.toString('utf8') }), { signingSecret });
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }
    if (event.type.startsWith('subscription')) {
      const payer = 'payer' in event.data ? event.data.payer : undefined;
      const clerkUserId = payer?.user_id;
      if (clerkUserId) await this.clerk.syncBilling(clerkUserId);
    }
    return { data: { received: true } };
  }
}
