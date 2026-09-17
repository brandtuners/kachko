import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z, createPageSchema, updatePageSchema, createBlockSchema, updateBlockSchema, reorderBlocksSchema, pageIdSchema, blockIdSchema, usernameSchema,
  type CreatePageInput, type UpdatePageInput, type CreateBlockInput, type UpdateBlockInput, type ReorderBlocksInput } from '@kachko/validation';
import { IdentityValidationPipe } from '../identity/identity.controller';
import { IdentityRateGuard, SessionGuard, RatePolicy, type IdentityRequest } from '../identity/identity.guards';
import { PagesService } from './pages.service';
import * as schema from './pages.swagger';
const pageId = new IdentityValidationPipe(pageIdSchema);
const blockId = new IdentityValidationPipe(blockIdSchema);
const emptyBody = new IdentityValidationPipe(z.strictObject({}).default({}));

@ApiTags('Pages and blocks')
@ApiCookieAuth()
@ApiHeader({ name: 'X-Kachko-CSRF', required: false, description: 'Required value 1 for POST, PATCH and DELETE' })
@ApiResponse({ status: 400, description: 'VALIDATION_ERROR: invalid IDs, fields or URL' })
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'CSRF_REJECTED' })
@ApiResponse({ status: 404, description: 'PAGE_NOT_FOUND or BLOCK_NOT_FOUND (also returned for foreign resources)' })
@ApiResponse({ status: 429, description: 'RATE_LIMITED; see Retry-After' })
@Controller('pages')
@RatePolicy('pages', 120, 60)
@UseGuards(IdentityRateGuard, SessionGuard)
export class PagesController {
  constructor(private readonly pages: PagesService) {}
  @Get()
  @ApiResponse({ status: 200, schema: schema.pagesResponse })
  list(@Req() request: IdentityRequest) { return this.pages.list(request.identity.id); }

  @Post()
  @ApiOperation({ summary: 'Create your single draft page; slug derives from your username' })
  @ApiBody({ schema: schema.pageCreateBody, examples: { basic: { value: { title: 'My links', description: 'Welcome to my page' } } } })
  @ApiResponse({ status: 201, schema: schema.pageResponse })
  @ApiResponse({ status: 409, description: 'PAGE_ALREADY_EXISTS' })
  create(@Req() request: IdentityRequest, @Body(new IdentityValidationPipe(createPageSchema)) input: CreatePageInput) {
    return this.pages.create(request.identity.id, input);
  }
  @Get(':id')
  @ApiResponse({ status: 200, schema: schema.pageResponse })
  get(@Req() request: IdentityRequest, @Param('id', pageId) id: string) { return this.pages.get(request.identity.id, id); }

  @Patch(':id')
  @ApiBody({ schema: schema.pageUpdateBody })
  @ApiResponse({ status: 200, schema: schema.pageResponse })
  update(@Req() request: IdentityRequest, @Param('id', pageId) id: string,
    @Body(new IdentityValidationPipe(updatePageSchema)) input: UpdatePageInput) { return this.pages.update(request.identity.id, id, input); }

  @Delete(':id')
  @ApiResponse({ status: 200, schema: schema.deletedResponse })
  delete(@Req() request: IdentityRequest, @Param('id', pageId) id: string) { return this.pages.delete(request.identity.id, id); }

  @Post(':id/publish')
  @HttpCode(200)
  @ApiResponse({ status: 200, schema: schema.pageResponse })
  publish(@Req() request: IdentityRequest, @Param('id', pageId) id: string, @Body(emptyBody) _body: unknown) {
    void _body;
    return this.pages.publish(request.identity.id, id, true);
  }
  @Post(':id/unpublish')
  @HttpCode(200)
  @ApiResponse({ status: 200, schema: schema.pageResponse })
  unpublish(@Req() request: IdentityRequest, @Param('id', pageId) id: string, @Body(emptyBody) _body: unknown) {
    void _body;
    return this.pages.publish(request.identity.id, id, false);
  }
  @Get(':id/qr')
  @ApiOperation({ summary: 'Generate a PNG QR code for the canonical public page URL' })
  @ApiResponse({ status: 200, description: 'PNG QR code; the encoded URL is returned in X-Kachko-QR-URL', content: { 'image/png': { schema: { type: 'string', format: 'binary' } } } })
  async qr(@Req() request: IdentityRequest, @Param('id', pageId) id: string, @Res({ passthrough: true }) response: Response) {
    const result = await this.pages.qr(request.identity.id, id);
    response.setHeader('X-Kachko-QR-URL', result.data.url);
    response.type('image/png').setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(result.data.png);
  }
  @Post(':pageId/blocks')
  @ApiBody({ schema: schema.blockCreateBody, examples: { website: { value: {
    type: 'LINK', content: { title: 'My website', url: 'https://example.com/', openInNewTab: true }, isVisible: true,
  } }, text: { value: { type: 'TEXT', content: { text: 'Welcome to my page', alignment: 'left' }, isVisible: true } } } })
  @ApiResponse({ status: 201, schema: schema.envelope(schema.block) })
  addBlock(@Req() request: IdentityRequest, @Param('pageId', pageId) id: string,
    @Body(new IdentityValidationPipe(createBlockSchema)) input: CreateBlockInput) { return this.pages.addBlock(request.identity.id, id, input); }

  @Post(':pageId/blocks/reorder')
  @HttpCode(200)
  @ApiOperation({ summary: 'Atomically reorder every current block, including hidden blocks' })
  @ApiBody({ schema: schema.reorderBody, examples: { twoBlocks: { value: { items: [
    { id: 'd6f0b953-461d-43b7-8e16-dbd98c10c1a1', position: 1 },
    { id: 'd6f0b953-461d-43b7-8e16-dbd98c10c1a2', position: 0 },
  ] } } } })
  @ApiResponse({ status: 200, schema: schema.pageResponse })
  @ApiResponse({ status: 409, description: 'BLOCK_ORDER_CONFLICT: block set changed or contains foreign/missing IDs; reload and retry' })
  reorder(@Req() request: IdentityRequest, @Param('pageId', pageId) id: string,
    @Body(new IdentityValidationPipe(reorderBlocksSchema)) input: ReorderBlocksInput) {
    return this.pages.reorder(request.identity.id, id, input);
  }

  @Patch(':pageId/blocks/:blockId')
  @ApiBody({ schema: schema.blockUpdateBody })
  @ApiResponse({ status: 200, schema: schema.envelope(schema.block) })
  updateBlock(@Req() request: IdentityRequest, @Param('pageId', pageId) id: string, @Param('blockId', blockId) block: string,
    @Body(new IdentityValidationPipe(updateBlockSchema)) input: UpdateBlockInput) {
    return this.pages.updateBlock(request.identity.id, id, block, input);
  }
  @Delete(':pageId/blocks/:blockId')
  @ApiResponse({ status: 200, schema: schema.deletedResponse })
  deleteBlock(@Req() request: IdentityRequest, @Param('pageId', pageId) id: string, @Param('blockId', blockId) block: string) {
    return this.pages.deleteBlock(request.identity.id, id, block);
  }
}

@ApiTags('Public pages')
@Controller('public')
export class PublicPagesController {
  constructor(private readonly pages: PagesService) {}
  @Get(':username')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Published profile and visible LINK/TEXT blocks; no authentication required' })
  @ApiResponse({ status: 200, schema: schema.publicResponse })
  @ApiResponse({ status: 404, description: 'PAGE_NOT_FOUND: missing, unpublished or inactive/deleted owner' })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR: malformed username' })
  get(@Param('username', new IdentityValidationPipe(usernameSchema)) username: string) { return this.pages.publicPage(username); }
}
