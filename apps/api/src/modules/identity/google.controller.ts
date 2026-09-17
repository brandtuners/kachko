import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { googleRegistrationSchema, z, type GoogleRegistrationInput } from '@kachko/validation';
import { GoogleService, GOOGLE_FLOW_TTL } from './google.service';
import { IdentityRateGuard, RatePolicy, SessionGuard, sessionCookie, type IdentityRequest } from './identity.guards';
import { IdentityValidationPipe } from './identity.controller';
import { identityCookieOptions, setIdentitySession } from './identity.cookies';

const STATE_COOKIE = 'kachko_google_state';
const PENDING_COOKIE = 'kachko_google_pending';
const LINK_COOKIE = 'kachko_google_link_pending';
const emptyBody = new IdentityValidationPipe(z.strictObject({}).default({}));
function cookie(request: Request, name: string) {
  const values = (request.headers.cookie ?? '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${name}=`));
  const value = values[0]?.slice(name.length + 1);
  return values.length === 1 && value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}
const scalar = (value: unknown) => typeof value === 'string' ? value : undefined;

@ApiTags('Google identity')
@ApiResponse({ status: 401, description: 'GOOGLE_AUTH_FAILED or GOOGLE_ONBOARDING_EXPIRED' })
@ApiResponse({ status: 403, description: 'GOOGLE_STATE_INVALID or CSRF_REJECTED' })
@ApiResponse({ status: 409, description: 'ACCOUNT_LINK_REQUIRED or ACCOUNT_UNAVAILABLE' })
@ApiResponse({ status: 429, description: 'RATE_LIMITED' })
@ApiResponse({ status: 503, description: 'GOOGLE_NOT_CONFIGURED or DEPENDENCIES_UNAVAILABLE' })
@Controller('auth/google')
@UseGuards(IdentityRateGuard)
export class GoogleController {
  constructor(private readonly google: GoogleService, private readonly config: ConfigService) {}
  @Get()
  @RatePolicy('google-start', 10, 60)
  @ApiOperation({ summary: 'Open this URL in a browser to start Google sign-in (not Swagger Execute)' })
  @ApiResponse({ status: 302, description: 'Redirects to Google; sets a 10-minute HTTP-only state cookie' })
  async start(@Res() response: Response) {
    const flow = await this.google.start();
    response.clearCookie(PENDING_COOKIE, identityCookieOptions(this.config));
    response.clearCookie(LINK_COOKIE, identityCookieOptions(this.config));
    response.cookie(STATE_COOKIE, flow.state, { ...identityCookieOptions(this.config), maxAge: GOOGLE_FLOW_TTL * 1000 });
    response.redirect(flow.url);
  }
  @Get('callback')
  @RatePolicy('google-callback', 20, 60)
  @ApiResponse({ status: 200, description: '{data:{onboardingRequired:true}} or {data:{onboardingRequired:false,user:IdentityUser}}' })
  @ApiResponse({ status: 302, description: 'Optional fixed frontend redirect with status=onboarding or authenticated' })
  async callback(@Query() query: Record<string, unknown>, @Req() request: Request, @Res() response: Response) {
    response.setHeader('Referrer-Policy', 'no-referrer');
    const result = await this.google.callback(scalar(query.state), cookie(request, STATE_COOKIE),
      scalar(query.code), scalar(query.error), sessionCookie(request, this.config));
    response.clearCookie(STATE_COOKIE, identityCookieOptions(this.config));
    if (result.session) {
      response.clearCookie(PENDING_COOKIE, identityCookieOptions(this.config));
      response.clearCookie(LINK_COOKIE, identityCookieOptions(this.config));
      setIdentitySession(this.config, response, result.session);
    }
    else if ('linkPending' in result) {
      response.clearCookie(PENDING_COOKIE, identityCookieOptions(this.config));
      response.cookie(LINK_COOKIE, result.linkPending, { ...identityCookieOptions(this.config), maxAge: GOOGLE_FLOW_TTL * 1000 });
    } else response.cookie(PENDING_COOKIE, result.pending, { ...identityCookieOptions(this.config), maxAge: GOOGLE_FLOW_TTL * 1000 });
    const redirect = this.config.get<string>('GOOGLE_LOGIN_REDIRECT_URL');
    if (redirect) {
      const url = new URL(redirect);
      url.searchParams.set('status', result.session ? 'authenticated' : 'linkPending' in result ? 'link-required' : 'onboarding');
      return response.redirect(url.toString());
    }
    return response.json({ data: result.session ? { onboardingRequired: false, user: result.session.user }
      : 'linkPending' in result ? { linkRequired: true } : { onboardingRequired: true } });
  }
  @Get('pending')
  @ApiResponse({ status: 200, description: '{data:{email:string}}; requires pending onboarding cookie' })
  async pending(@Req() request: Request) {
    const profile = await this.google.pending(cookie(request, PENDING_COOKIE));
    return { data: { email: profile.email } };
  }
  @Post('complete')
  @RatePolicy('google-complete', 3, 3600)
  @ApiHeader({ name: 'X-Kachko-CSRF', required: true, description: 'Required value 1' })
  @ApiBody({ schema: { type: 'object', required: ['username'], additionalProperties: false, properties: {
    username: { type: 'string', minLength: 3, maxLength: 30 }, displayName: { type: 'string', minLength: 1, maxLength: 80 },
  } } })
  @ApiResponse({ status: 201, description: '{data:IdentityUser}; creates account and sets session cookie' })
  async complete(@Body(new IdentityValidationPipe(googleRegistrationSchema)) input: GoogleRegistrationInput,
    @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const session = await this.google.complete(cookie(request, PENDING_COOKIE), input, sessionCookie(request, this.config));
    response.clearCookie(PENDING_COOKIE, identityCookieOptions(this.config));
    setIdentitySession(this.config, response, session);
    return { data: session.user };
  }

  @Post('link/complete')
  @HttpCode(200)
  @RatePolicy('google-link', 5, 3600)
  @UseGuards(SessionGuard)
  @ApiHeader({ name: 'X-Kachko-CSRF', required: true })
  @ApiResponse({ status: 200, description: '{data:{linked:true}}; requires existing account session and link grant cookie' })
  async completeLink(@Body(emptyBody) _body: unknown, @Req() request: IdentityRequest,
    @Res({ passthrough: true }) response: Response) {
    void _body;
    const result = await this.google.completeLink(cookie(request, LINK_COOKIE), request.identity.id);
    response.clearCookie(LINK_COOKIE, identityCookieOptions(this.config));
    return result;
  }
}
