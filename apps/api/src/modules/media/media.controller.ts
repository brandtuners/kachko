import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Put, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { completeMediaUploadSchema, mediaIdSchema, requestMediaUploadSchema, type CompleteMediaUploadInput, type RequestMediaUploadInput } from '@kachko/validation';
import { IdentityValidationPipe } from '../identity/identity.controller';
import { IdentityRateGuard, RatePolicy, SessionGuard, type IdentityRequest } from '../identity/identity.guards';
import { MediaService } from './media.service';

const idPipe = new IdentityValidationPipe(mediaIdSchema);

@ApiTags('Media')
@ApiCookieAuth()
@ApiHeader({ name: 'X-Kachko-CSRF', required: false, description: 'Required value 1 for mutations' })
@Controller('media')
@UseGuards(IdentityRateGuard, SessionGuard)
@RatePolicy('media', 60, 60)
export class MediaController {
  constructor(private readonly media: MediaService) {}
  @Post('upload-url')
  @ApiOperation({ summary: 'Authorize a bounded image upload for the current owner' })
  @ApiBody({ schema: { type: 'object', required: ['mimeType', 'size'], properties: { mimeType: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] }, size: { type: 'integer', maximum: 5242880 }, forAvatar: { type: 'boolean' } } } })
  authorize(@Req() req: IdentityRequest, @Body(new IdentityValidationPipe(requestMediaUploadSchema)) input: RequestMediaUploadInput) { return this.media.authorize(req.identity.id, input); }

  @Put('uploads/:storageKey')
  @HttpCode(204)
  @ApiConsumes('image/jpeg', 'image/png', 'image/webp', 'image/gif')
  @ApiOperation({ summary: 'Local development upload target; R2 mode returns a presigned external target instead' })
  async upload(@Req() req: IdentityRequest, @Param('storageKey', idPipe) storageKey: string) {
    await this.media.acceptLocal(req.identity.id, storageKey, req.headers['content-type'], req.body);
  }

  @Post('complete')
  @HttpCode(200)
  complete(@Req() req: IdentityRequest, @Body(new IdentityValidationPipe(completeMediaUploadSchema)) input: CompleteMediaUploadInput) { return this.media.complete(req.identity.id, input); }

  @Get()
  list(@Req() req: IdentityRequest) { return this.media.list(req.identity.id); }
  @Delete('avatar')
  clearAvatar(@Req() req: IdentityRequest) { return this.media.clearAvatar(req.identity.id); }
  @Get(':mediaId')
  get(@Req() req: IdentityRequest, @Param('mediaId', idPipe) id: string) { return this.media.owned(req.identity.id, id); }
  @Delete(':mediaId')
  delete(@Req() req: IdentityRequest, @Param('mediaId', idPipe) id: string) { return this.media.delete(req.identity.id, id); }
}

@ApiTags('Public media')
@Controller('media/files')
export class PublicMediaController {
  constructor(private readonly media: MediaService) {}
  @Get(':mediaId')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @ApiResponse({ status: 200, description: 'Validated image bytes' })
  async file(@Param('mediaId', idPipe) id: string, @Res({ passthrough: true }) response: Response) {
    const { media, bytes } = await this.media.publicFile(id);
    response.type(media.mimeType).setHeader('Content-Length', bytes.length);
    return new StreamableFile(bytes);
  }
}
