import { Body, Controller, Get, Header, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z, createShortLinkSchema, updateShortLinkSchema, shortLinkCodeSchema, shortLinkListSchema,
  type CreateShortLinkInput, type UpdateShortLinkInput } from '@kachko/validation';
import { IdentityValidationPipe } from '../identity/identity.controller';
import { IdentityRateGuard, RatePolicy, SessionGuard, type IdentityRequest } from '../identity/identity.guards';
import { ShortLinksService } from './short-links.service';

const idPipe = new IdentityValidationPipe(z.uuid());

@ApiTags('Short links')
@ApiCookieAuth()
@Controller('short-links')
@UseGuards(IdentityRateGuard, SessionGuard)
@RatePolicy('short-links', 120, 60)
export class ShortLinksController {
  constructor(private readonly links: ShortLinksService) {}
  @Get()
  list(@Req() request: IdentityRequest, @Query(new IdentityValidationPipe(shortLinkListSchema)) query: { cursor?: string }) {
    return this.links.list(request.identity.id, query.cursor);
  }
  @Post()
  create(@Req() request: IdentityRequest, @Body(new IdentityValidationPipe(createShortLinkSchema)) input: CreateShortLinkInput) {
    return this.links.create(request.identity.id, input);
  }
  @Patch(':id')
  update(@Req() request: IdentityRequest, @Param('id', idPipe) id: string,
    @Body(new IdentityValidationPipe(updateShortLinkSchema)) input: UpdateShortLinkInput) {
    return this.links.update(request.identity.id, id, input);
  }
  @Get(':id/stats')
  stats(@Req() request: IdentityRequest, @Param('id', idPipe) id: string) { return this.links.stats(request.identity.id, id); }
}

@ApiTags('Short links')
@Controller('short-links/r')
@UseGuards(IdentityRateGuard)
@RatePolicy('short-links-redirect', 240, 60)
export class PublicShortLinksController {
  constructor(private readonly links: ShortLinksService) {}
  @Get(':code')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Resolve an active short link and record privacy-safe click metadata' })
  async redirect(@Param('code', new IdentityValidationPipe(shortLinkCodeSchema)) code: string,
    @Req() request: Request, @Res() response: Response) {
    return response.redirect(302, await this.links.resolve(code, request));
  }
}
