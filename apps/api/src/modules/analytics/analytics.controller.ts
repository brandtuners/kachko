import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { analyticsEventSchema, analyticsRangeSchema, pageIdSchema,
  type AnalyticsEventInput, type AnalyticsRangeInput } from '@kachko/validation';
import { IdentityValidationPipe } from '../identity/identity.controller';
import { IdentityRateGuard, RatePolicy, SessionGuard, SkipCsrf, type IdentityRequest } from '../identity/identity.guards';
import { AnalyticsService } from './analytics.service';

const pageId = new IdentityValidationPipe(pageIdSchema);
const range = new IdentityValidationPipe(analyticsRangeSchema);
const rangeQuery = () => ApiQuery({ name: 'range', required: false, enum: ['today', '7d', '30d'], example: '7d' });
const periodProperties = {
  range: { type: 'string', enum: ['today', '7d', '30d'] }, from: { type: 'string', format: 'date-time' }, to: { type: 'string', format: 'date-time' },
};

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(IdentityRateGuard)
export class AnalyticsIngestionController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('events')
  @HttpCode(202)
  @SkipCsrf()
  @RatePolicy('analytics', 120, 60)
  @ApiOperation({ summary: 'Record a validated event for a published page' })
  @ApiBody({ schema: { type: 'object', required: ['pageId', 'eventType'], additionalProperties: false, properties: {
    pageId: { type: 'string', format: 'uuid' }, blockId: { type: 'string', format: 'uuid' }, socialProfileId: { type: 'string', format: 'uuid' },
    eventType: { type: 'string', enum: ['PAGE_VIEW', 'LINK_CLICK', 'SOCIAL_CLICK'] },
  } } })
  @ApiResponse({ status: 202, schema: { type: 'object', properties: { data: { type: 'object', properties: { accepted: { type: 'boolean', enum: [true] } } } } } })
  @ApiResponse({ status: 404, description: 'ANALYTICS_TARGET_NOT_FOUND: page is not public or block is missing, hidden or the wrong type' })
  @ApiResponse({ status: 429, description: 'RATE_LIMITED; see Retry-After' })
  ingest(@Body(new IdentityValidationPipe(analyticsEventSchema)) input: AnalyticsEventInput, @Req() request: Request) {
    return this.analytics.ingest(input, request);
  }
}

@ApiTags('Analytics')
@ApiCookieAuth()
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 404, description: 'PAGE_NOT_FOUND, including foreign page IDs' })
@Controller('pages/:pageId/analytics')
@RatePolicy('analytics-query', 120, 60)
@UseGuards(IdentityRateGuard, SessionGuard)
export class AnalyticsQueryController {
  constructor(private readonly analytics: AnalyticsService) {}
  private query(request: IdentityRequest, id: string, input: AnalyticsRangeInput, method: 'summary' | 'timeseries' | 'topLinks' | 'topSocials' | 'referrers' | 'geo' | 'devices') {
    return this.analytics[method](request.identity.id, id, input);
  }

  @Get('summary')
  @rangeQuery()
  @ApiResponse({ status: 200, schema: { type: 'object', properties: { data: { type: 'object', properties: {
    ...periodProperties, totalViews: { type: 'integer' }, uniqueVisitors: { type: 'integer' }, linkClicks: { type: 'integer' },
    socialClicks: { type: 'integer' }, clickThroughRate: { type: 'number' },
  } } } } })
  summary(@Req() req: IdentityRequest, @Param('pageId', pageId) id: string, @Query(range) input: AnalyticsRangeInput) { return this.query(req, id, input, 'summary'); }

  @Get('timeseries')
  @rangeQuery()
  timeseries(@Req() req: IdentityRequest, @Param('pageId', pageId) id: string, @Query(range) input: AnalyticsRangeInput) { return this.query(req, id, input, 'timeseries'); }

  @Get('top-links')
  @rangeQuery()
  topLinks(@Req() req: IdentityRequest, @Param('pageId', pageId) id: string, @Query(range) input: AnalyticsRangeInput) { return this.query(req, id, input, 'topLinks'); }

  @Get('top-socials')
  @rangeQuery()
  topSocials(@Req() req: IdentityRequest, @Param('pageId', pageId) id: string, @Query(range) input: AnalyticsRangeInput) { return this.query(req, id, input, 'topSocials'); }

  @Get('referrers')
  @rangeQuery()
  referrers(@Req() req: IdentityRequest, @Param('pageId', pageId) id: string, @Query(range) input: AnalyticsRangeInput) { return this.query(req, id, input, 'referrers'); }

  @Get('geo')
  @rangeQuery()
  geo(@Req() req: IdentityRequest, @Param('pageId', pageId) id: string, @Query(range) input: AnalyticsRangeInput) { return this.query(req, id, input, 'geo'); }

  @Get('devices')
  @rangeQuery()
  devices(@Req() req: IdentityRequest, @Param('pageId', pageId) id: string, @Query(range) input: AnalyticsRangeInput) { return this.query(req, id, input, 'devices'); }
}
