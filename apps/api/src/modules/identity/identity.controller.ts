import { identityCookieOptions, setIdentitySession } from './identity.cookies';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, Res, UseGuards, type PipeTransform } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiCookieAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { Request, Response } from 'express';
import { z, registerSchema, loginSchema, profileSchema, usernameSchema,
  type RegisterInput, type LoginInput, type ProfileInput } from '@kachko/validation';
import { IdentityService, identityError } from './identity.service';
import { IdentityRateGuard, SessionGuard, RatePolicy, sessionCookie, type IdentityRequest } from './identity.guards';

export class IdentityValidationPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodType) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) identityError(400, 'VALIDATION_ERROR', result.error.issues
      .map(issue => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; '));
    return result.data;
  }
}
const bodySchema = (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input' }) as SchemaObject;
const userSchema: SchemaObject = {
  type: 'object', required: ['data'], properties: { data: {
    type: 'object', required: ['id', 'email', 'username', 'displayName', 'bio', 'avatarUrl'], properties: {
      id: { type: 'string', format: 'uuid' }, email: { type: 'string', format: 'email' }, username: { type: 'string' },
      displayName: { type: 'string', nullable: true }, bio: { type: 'string', nullable: true }, avatarUrl: { type: 'string', nullable: true },
    },
  } },
};

@ApiTags('Identity')
@ApiHeader({ name: 'X-Kachko-CSRF', description: 'Required value 1 for POST/PATCH requests', required: false })
@ApiResponse({ status: 400, description: 'VALIDATION_ERROR: invalid or unknown fields' })
@ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS or UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'CSRF_REJECTED' })
@ApiResponse({ status: 429, description: 'RATE_LIMITED; see Retry-After' })
@ApiResponse({ status: 503, description: 'Required services unavailable' })
@Controller('auth')
@UseGuards(IdentityRateGuard)
export class AuthController {
  constructor(private readonly identity: IdentityService, private readonly config: ConfigService) {}
  @Post('register')
  @RatePolicy('register', 3, 3600)
  @ApiOperation({ summary: 'Register and create a cookie session' })
  @ApiBody({ schema: bodySchema(registerSchema) })
  @ApiResponse({ status: 201, schema: userSchema })
  @ApiResponse({ status: 409, description: 'ACCOUNT_UNAVAILABLE' })
  async register(@Body(new IdentityValidationPipe(registerSchema)) input: RegisterInput,
    @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const session = await this.identity.register(input, sessionCookie(request, this.config));
    setIdentitySession(this.config, response, session);
    return { data: session.user };
  }
  @Post('login')
  @HttpCode(200)
  @RatePolicy('login', 5, 60)
  @ApiBody({ schema: bodySchema(loginSchema) })
  @ApiResponse({ status: 200, schema: userSchema })
  async login(@Body(new IdentityValidationPipe(loginSchema)) input: LoginInput,
    @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const session = await this.identity.login(input, sessionCookie(request, this.config));
    setIdentitySession(this.config, response, session);
    return { data: session.user };
  }
  @Get('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiResponse({ status: 200, schema: userSchema })
  me(@Req() request: IdentityRequest) { return { data: request.identity }; }

  @Post('logout')
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiResponse({ status: 200, schema: { type: 'object', properties: { data: { type: 'object', properties: { loggedOut: { type: 'boolean', enum: [true] } } } } } })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.identity.logout(sessionCookie(request, this.config));
    response.clearCookie(this.config.getOrThrow<string>('SESSION_COOKIE_NAME'), identityCookieOptions(this.config));
    return result;
  }
}

@ApiTags('Users')
@ApiHeader({ name: 'X-Kachko-CSRF', description: 'Required value 1 for PATCH', required: false })
@ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'CSRF_REJECTED' })
@ApiResponse({ status: 429, description: 'RATE_LIMITED; see Retry-After' })
@ApiResponse({ status: 503, description: 'Required services unavailable' })
@Controller('users')
@UseGuards(IdentityRateGuard)
export class UsersController {
  constructor(private readonly identity: IdentityService) {}
  @Get('username/:username')
  @RatePolicy('username', 60, 60)
  @ApiResponse({ status: 200, schema: { type: 'object', properties: { data: { type: 'object', properties: {
    username: { type: 'string' }, available: { type: 'boolean' }, reason: { type: 'string', enum: ['reserved', 'taken'] },
  } } } } })
  availability(@Param('username', new IdentityValidationPipe(usernameSchema)) username: string) {
    return this.identity.availability(username);
  }
  @Get('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiResponse({ status: 200, schema: userSchema })
  me(@Req() request: IdentityRequest) { return { data: request.identity }; }

  @Patch('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiBody({ schema: bodySchema(profileSchema) })
  @ApiResponse({ status: 200, schema: userSchema })
  @ApiResponse({ status: 409, description: 'USERNAME_UNAVAILABLE' })
  update(@Req() request: IdentityRequest, @Body(new IdentityValidationPipe(profileSchema)) input: ProfileInput) {
    return this.identity.updateProfile(request.identity.id, input);
  }
}
