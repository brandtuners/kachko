import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { adminListQuerySchema, adminPageStatusUpdateSchema, createReportSchema, deleteAccountSchema, pageIdSchema, reportStatusSchema, reportStatusUpdateSchema, userStatusUpdateSchema,
  type AdminListQueryInput, type AdminPageStatusUpdateInput, type CreateReportInput, type DeleteAccountInput, type ReportStatusUpdateInput, type UserStatusUpdateInput } from '@kachko/validation';
import { IdentityValidationPipe } from '../identity/identity.controller';
import { IdentityRateGuard, RatePolicy, SessionGuard, type IdentityRequest } from '../identity/identity.guards';
import { identityCookieOptions } from '../identity/identity.cookies';
import { ConfigService } from '@nestjs/config';
import { AdminGuard, StaffGuard } from './moderation.guard';
import { ModerationService } from './moderation.service';

@ApiTags('Moderation')
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post('reports')
  @HttpCode(202)
  @RatePolicy('reports', 5, 3600)
  @UseGuards(IdentityRateGuard)
  create(@Body(new IdentityValidationPipe(createReportSchema)) input: CreateReportInput) { return this.moderation.createReport(input); }

  @Get('reports')
  @ApiCookieAuth()
  @UseGuards(IdentityRateGuard, SessionGuard, StaffGuard)
  reports(@Query('status', new IdentityValidationPipe(reportStatusSchema.default('OPEN'))) status: 'OPEN' | 'RESOLVED' | 'REJECTED') {
    return this.moderation.reports(status);
  }

  @Post('reports/:id/status')
  @HttpCode(200)
  @ApiCookieAuth()
  @UseGuards(IdentityRateGuard, SessionGuard, StaffGuard)
  update(@Req() request: IdentityRequest, @Param('id', new IdentityValidationPipe(pageIdSchema)) id: string,
    @Body(new IdentityValidationPipe(reportStatusUpdateSchema)) input: ReportStatusUpdateInput) {
    return this.moderation.updateReport(request.identity.id, id, input);
  }

  @Patch('users/:id/status')
  @ApiCookieAuth()
  @UseGuards(IdentityRateGuard, SessionGuard, AdminGuard)
  userStatus(@Req() request: IdentityRequest, @Param('id', new IdentityValidationPipe(pageIdSchema)) id: string,
    @Body(new IdentityValidationPipe(userStatusUpdateSchema)) input: UserStatusUpdateInput) {
    return this.moderation.updateUserStatus(request.identity.id, id, input);
  }

  @Get('audit-logs')
  @ApiCookieAuth()
  @UseGuards(IdentityRateGuard, SessionGuard, AdminGuard)
  auditLogs() { return this.moderation.auditLogs(); }
}

@ApiTags('Admin')
@ApiCookieAuth()
@Controller('admin')
@UseGuards(IdentityRateGuard, SessionGuard, AdminGuard)
export class AdminController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('users')
  users(@Query(new IdentityValidationPipe(adminListQuerySchema)) input: AdminListQueryInput) {
    return this.moderation.adminUsers(input);
  }

  @Patch('users/:id/status')
  userStatus(@Req() request: IdentityRequest, @Param('id', new IdentityValidationPipe(pageIdSchema)) id: string,
    @Body(new IdentityValidationPipe(userStatusUpdateSchema)) input: UserStatusUpdateInput) {
    return this.moderation.updateUserStatus(request.identity.id, id, input);
  }

  @Delete('users/:id')
  deleteUser(@Req() request: IdentityRequest, @Param('id', new IdentityValidationPipe(pageIdSchema)) id: string,
    @Body(new IdentityValidationPipe(deleteAccountSchema)) input: DeleteAccountInput) {
    void input;
    return this.moderation.deleteUserAsAdmin(request.identity.id, id);
  }

  @Get('pages')
  pages(@Query(new IdentityValidationPipe(adminListQuerySchema)) input: AdminListQueryInput) {
    return this.moderation.adminPages(input);
  }

  @Patch('pages/:id/status')
  pageStatus(@Req() request: IdentityRequest, @Param('id', new IdentityValidationPipe(pageIdSchema)) id: string,
    @Body(new IdentityValidationPipe(adminPageStatusUpdateSchema)) input: AdminPageStatusUpdateInput) {
    return this.moderation.updatePageStatus(request.identity.id, id, input);
  }

  @Get('reports')
  reports(@Query('status', new IdentityValidationPipe(reportStatusSchema.default('OPEN'))) status: 'OPEN' | 'RESOLVED' | 'REJECTED') {
    return this.moderation.reports(status);
  }

  @Patch('reports/:id')
  updateReport(@Req() request: IdentityRequest, @Param('id', new IdentityValidationPipe(pageIdSchema)) id: string,
    @Body(new IdentityValidationPipe(reportStatusUpdateSchema)) input: ReportStatusUpdateInput) {
    return this.moderation.updateReport(request.identity.id, id, input);
  }

  @Get('audit-logs')
  auditLogs() { return this.moderation.auditLogs(); }

  @Get('system/health')
  health() { return this.moderation.adminHealth(); }
}

@ApiTags('Users')
@Controller('users')
export class AccountDeletionController {
  constructor(private readonly moderation: ModerationService, private readonly config: ConfigService) {}

  @Delete('me')
  @ApiCookieAuth()
  @UseGuards(IdentityRateGuard, SessionGuard)
  async delete(@Req() request: IdentityRequest, @Res({ passthrough: true }) response: Response,
    @Body(new IdentityValidationPipe(deleteAccountSchema)) input: DeleteAccountInput) {
    const result = await this.moderation.deleteAccount(request.identity.id, input);
    response.clearCookie(this.config.getOrThrow<string>('SESSION_COOKIE_NAME'), identityCookieOptions(this.config));
    return result;
  }
}
