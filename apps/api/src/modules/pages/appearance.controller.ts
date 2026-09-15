import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { pageIdSchema, updateAppearanceSchema, applyTemplateSchema, createSocialSchema, updateSocialSchema, reorderBlocksSchema,
  type UpdateAppearanceInput, type ApplyTemplateInput, type CreateSocialInput, type UpdateSocialInput, type ReorderBlocksInput } from '@kachko/validation';
import { IdentityValidationPipe } from '../identity/identity.controller';
import { IdentityRateGuard, SessionGuard, RatePolicy, type IdentityRequest } from '../identity/identity.guards';
import { PagesService } from './pages.service';
import * as schema from './pages.swagger';
const idPipe = new IdentityValidationPipe(pageIdSchema);

@ApiTags('Themes and templates')
@Controller()
export class AppearanceCatalogController {
  constructor(private readonly pages: PagesService) {}
  @Get('themes')
  @Header('Cache-Control', 'no-store')
  @ApiResponse({ status: 200, schema: schema.themesResponse })
  themes() { return this.pages.themes(); }
  @Get('themes/:key')
  @Header('Cache-Control', 'no-store')
  @ApiResponse({ status: 200, schema: schema.envelope(schema.theme) })
  @ApiResponse({ status: 404, description: 'THEME_NOT_FOUND' })
  theme(@Param('key') key: string) { return this.pages.theme(key); }
  @Get('templates')
  @Header('Cache-Control', 'no-store')
  @ApiResponse({ status: 200, schema: schema.templatesResponse })
  templates() { return this.pages.templates(); }
  @Get('templates/:key')
  @Header('Cache-Control', 'no-store')
  @ApiResponse({ status: 200, schema: schema.envelope(schema.template) })
  @ApiResponse({ status: 404, description: 'TEMPLATE_NOT_FOUND' })
  template(@Param('key') key: string) { return this.pages.template(key); }
}

@ApiTags('Appearance and social profiles')
@ApiCookieAuth()
@ApiHeader({ name: 'X-Kachko-CSRF', description: 'Required value 1 for POST/PATCH/DELETE', required: false })
@ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'CSRF_REJECTED' })
@ApiResponse({ status: 404, description: 'PAGE_NOT_FOUND, SOCIAL_NOT_FOUND, THEME_NOT_FOUND or TEMPLATE_NOT_FOUND' })
@ApiResponse({ status: 429, description: 'RATE_LIMITED' })
@Controller('pages/:pageId')
@RatePolicy('pages', 120, 60)
@UseGuards(IdentityRateGuard, SessionGuard)
export class PageAppearanceController {
  constructor(private readonly pages: PagesService) {}
  @Get('appearance')
  @ApiResponse({ status: 200, schema: schema.appearanceResponse })
  async appearance(@Req() req: IdentityRequest, @Param('pageId', idPipe) id: string) {
    const { data } = await this.pages.get(req.identity.id, id);
    return { data: { themeKey: data.themeKey, appearance: data.appearance, overrides: data.appearanceOverrides } };
  }
  @Patch('appearance')
  @ApiBody({ schema: schema.appearanceBody, examples: { dark: { value: { themeKey: 'dark' } }, custom: { value: { overrides: { buttons: { radius: 20 }, typography: { titleSize: 36 } } } } } })
  @ApiResponse({ status: 200, schema: schema.pageResponse })
  updateAppearance(@Req() req: IdentityRequest, @Param('pageId', idPipe) id: string,
    @Body(new IdentityValidationPipe(updateAppearanceSchema)) input: UpdateAppearanceInput) { return this.pages.appearance(req.identity.id, id, input); }
  @Post('template')
  @HttpCode(200)
  @ApiOperation({ summary: 'Apply a template; confirm replacement if the page has blocks' })
  @ApiBody({ schema: schema.templateBody, examples: { starter: { value: { templateKey: 'starter', replaceExistingBlocks: false } } } })
  @ApiResponse({ status: 200, schema: schema.pageResponse })
  @ApiResponse({ status: 409, description: 'TEMPLATE_REPLACE_REQUIRED' })
  applyTemplate(@Req() req: IdentityRequest, @Param('pageId', idPipe) id: string,
    @Body(new IdentityValidationPipe(applyTemplateSchema)) input: ApplyTemplateInput) { return this.pages.applyTemplate(req.identity.id, id, input); }
  @Get('socials')
  @ApiResponse({ status: 200, schema: schema.socialsResponse })
  socials(@Req() req: IdentityRequest, @Param('pageId', idPipe) id: string) { return this.pages.socials(req.identity.id, id); }
  @Post('socials')
  @ApiBody({ schema: schema.socialCreateBody, examples: { github: { value: { platform: 'GITHUB', username: 'rohan', url: 'https://github.com/rohan', isVisible: true } } } })
  @ApiResponse({ status: 201, schema: schema.envelope(schema.social) })
  addSocial(@Req() req: IdentityRequest, @Param('pageId', idPipe) id: string,
    @Body(new IdentityValidationPipe(createSocialSchema)) input: CreateSocialInput) { return this.pages.addSocial(req.identity.id, id, input); }
  @Patch('socials/:socialId')
  @ApiBody({ schema: schema.socialUpdateBody })
  @ApiResponse({ status: 200, schema: schema.envelope(schema.social) })
  updateSocial(@Req() req: IdentityRequest, @Param('pageId', idPipe) id: string, @Param('socialId', idPipe) socialId: string,
    @Body(new IdentityValidationPipe(updateSocialSchema)) input: UpdateSocialInput) { return this.pages.updateSocial(req.identity.id, id, socialId, input); }
  @Delete('socials/:socialId')
  @ApiResponse({ status: 200, schema: schema.deletedResponse })
  deleteSocial(@Req() req: IdentityRequest, @Param('pageId', idPipe) id: string, @Param('socialId', idPipe) socialId: string) {
    return this.pages.deleteSocial(req.identity.id, id, socialId);
  }
  @Post('socials/reorder')
  @HttpCode(200)
  @ApiBody({ schema: schema.reorderBody })
  @ApiResponse({ status: 200, schema: schema.socialsResponse })
  @ApiResponse({ status: 409, description: 'SOCIAL_ORDER_CONFLICT' })
  reorderSocials(@Req() req: IdentityRequest, @Param('pageId', idPipe) id: string,
    @Body(new IdentityValidationPipe(reorderBlocksSchema)) input: ReorderBlocksInput) { return this.pages.reorderSocials(req.identity.id, id, input); }
}
