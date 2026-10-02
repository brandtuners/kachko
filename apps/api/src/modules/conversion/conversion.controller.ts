import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { z, audienceQuerySchema, contactIdSchema, contactNoteSchema, contactTagSchema, createFormFieldSchema, createFormSchema, fieldIdSchema, formIdSchema, pageIdSchema, publicSubmissionSchema, reorderFormFieldsSchema, tagIdSchema, updateContactSchema, updateFormFieldSchema, updateFormSchema,
  type AudienceQueryInput, type CreateFormFieldInput, type CreateFormInput, type PublicSubmissionInput, type ReorderFormFieldsInput, type UpdateContactInput, type UpdateFormFieldInput, type UpdateFormInput } from '@kachko/validation';
import { IdentityValidationPipe } from '../identity/identity.controller';
import { IdentityRateGuard, RatePolicy, SessionGuard, SkipCsrf, type IdentityRequest } from '../identity/identity.guards';
import { ConversionService } from './conversion.service';

const uuid = (schema: z.ZodType<string>) => new IdentityValidationPipe(schema);

@ApiTags('Forms') @ApiCookieAuth() @Controller() @UseGuards(IdentityRateGuard, SessionGuard) @RatePolicy('forms', 120, 60)
export class FormsController {
  constructor(private readonly conversion: ConversionService) {}
  @Get('pages/:pageId/forms') list(@Req() req: IdentityRequest, @Param('pageId', uuid(pageIdSchema)) pageId: string) { return this.conversion.listForms(req.identity.id, pageId); }
  @Post('pages/:pageId/forms') create(@Req() req: IdentityRequest, @Param('pageId', uuid(pageIdSchema)) pageId: string, @Body(new IdentityValidationPipe(createFormSchema)) input: CreateFormInput) { return this.conversion.createForm(req.identity.id, pageId, input); }
  @Get('forms/:formId') get(@Req() req: IdentityRequest, @Param('formId', uuid(formIdSchema)) id: string) { return this.conversion.form(req.identity.id, id); }
  @Patch('forms/:formId') update(@Req() req: IdentityRequest, @Param('formId', uuid(formIdSchema)) id: string, @Body(new IdentityValidationPipe(updateFormSchema)) input: UpdateFormInput) { return this.conversion.updateForm(req.identity.id, id, input); }
  @Delete('forms/:formId') delete(@Req() req: IdentityRequest, @Param('formId', uuid(formIdSchema)) id: string) { return this.conversion.deleteForm(req.identity.id, id); }
  @Post('forms/:formId/fields') field(@Req() req: IdentityRequest, @Param('formId', uuid(formIdSchema)) id: string, @Body(new IdentityValidationPipe(createFormFieldSchema)) input: CreateFormFieldInput) { return this.conversion.addField(req.identity.id, id, input); }
  @Patch('forms/:formId/fields/:fieldId') updateField(@Req() req: IdentityRequest, @Param('formId', uuid(formIdSchema)) id: string, @Param('fieldId', uuid(fieldIdSchema)) fieldId: string, @Body(new IdentityValidationPipe(updateFormFieldSchema)) input: UpdateFormFieldInput) { return this.conversion.updateField(req.identity.id, id, fieldId, input); }
  @Delete('forms/:formId/fields/:fieldId') deleteField(@Req() req: IdentityRequest, @Param('formId', uuid(formIdSchema)) id: string, @Param('fieldId', uuid(fieldIdSchema)) fieldId: string) { return this.conversion.deleteField(req.identity.id, id, fieldId); }
  @Post('forms/:formId/fields/reorder') @HttpCode(200) reorder(@Req() req: IdentityRequest, @Param('formId', uuid(formIdSchema)) id: string, @Body(new IdentityValidationPipe(reorderFormFieldsSchema)) input: ReorderFormFieldsInput) { return this.conversion.reorderFields(req.identity.id, id, input); }
}

@ApiTags('Public forms') @Controller('public/forms') @UseGuards(IdentityRateGuard)
export class PublicFormsController {
  constructor(private readonly conversion: ConversionService) {}
  @Post(':formId/submissions') @HttpCode(201) @SkipCsrf() @RatePolicy('public-form-submit', 10, 60)
  submit(@Param('formId', uuid(formIdSchema)) id: string, @Body(new IdentityValidationPipe(publicSubmissionSchema)) input: PublicSubmissionInput, @Req() req: Request) { return this.conversion.submit(id, input, req); }
}

@ApiTags('Audience') @ApiCookieAuth() @Controller('audience') @UseGuards(IdentityRateGuard, SessionGuard) @RatePolicy('audience', 120, 60)
export class AudienceController {
  constructor(private readonly conversion: ConversionService) {}
  @Get('contacts') contacts(@Req() req: IdentityRequest, @Query(new IdentityValidationPipe(audienceQuerySchema)) query: AudienceQueryInput) { return this.conversion.contacts(req.identity.id, query); }
  @Get('contacts/:contactId') contact(@Req() req: IdentityRequest, @Param('contactId', uuid(contactIdSchema)) id: string) { return this.conversion.contact(req.identity.id, id); }
  @Patch('contacts/:contactId') update(@Req() req: IdentityRequest, @Param('contactId', uuid(contactIdSchema)) id: string, @Body(new IdentityValidationPipe(updateContactSchema)) input: UpdateContactInput) { return this.conversion.updateContact(req.identity.id, id, input); }
  @Post('contacts/:contactId/notes') note(@Req() req: IdentityRequest, @Param('contactId', uuid(contactIdSchema)) id: string, @Body(new IdentityValidationPipe(contactNoteSchema)) input: { note: string }) { return this.conversion.addNote(req.identity.id, id, input.note); }
  @Post('contacts/:contactId/tags') tag(@Req() req: IdentityRequest, @Param('contactId', uuid(contactIdSchema)) id: string, @Body(new IdentityValidationPipe(contactTagSchema)) input: { name: string }) { return this.conversion.addTag(req.identity.id, id, input.name); }
  @Delete('contacts/:contactId/tags/:tagId') removeTag(@Req() req: IdentityRequest, @Param('contactId', uuid(contactIdSchema)) id: string, @Param('tagId', uuid(tagIdSchema)) tagId: string) { return this.conversion.removeTag(req.identity.id, id, tagId); }
  @Get('export') @Header('Content-Type', 'text/csv; charset=utf-8') async export(@Req() req: IdentityRequest, @Res({ passthrough: true }) response: Response) { response.setHeader('Content-Disposition', 'attachment; filename="kachko-audience.csv"'); return this.conversion.csv(req.identity.id); }
}
