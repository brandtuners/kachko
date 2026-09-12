import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

const checksSchema = {
  type: 'object' as const,
  required: ['postgres', 'redis'],
  properties: {
    postgres: { type: 'string' as const, enum: ['up', 'down'] },
    redis: { type: 'string' as const, enum: ['up', 'down'] },
  },
};

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  health() {
    return { data: { status: 'ok' } };
  }

  @Get('live')
  live() {
    return { data: { status: 'live' } };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    description: 'PostgreSQL and Redis are reachable.',
    schema: { type: 'object', required: ['data'], properties: { data: {
      type: 'object', required: ['status', 'checks'], properties: {
        status: { type: 'string', enum: ['ready'] }, checks: checksSchema,
      },
    } } },
  })
  @ApiServiceUnavailableResponse({
    description: 'A dependency is unavailable or the application is shutting down.',
    schema: { type: 'object', required: ['error'], properties: { error: {
      type: 'object', required: ['code', 'message', 'checks'], properties: {
        code: { type: 'string', enum: ['DEPENDENCIES_UNAVAILABLE'] },
        message: { type: 'string' }, checks: checksSchema,
      },
    } } },
  })
  async ready(@Res({ passthrough: true }) response: Response) {
    const result = await this.healthService.readiness();
    if (!result.ready) {
      response.status(503);
      return { error: {
        code: 'DEPENDENCIES_UNAVAILABLE',
        message: 'Required services are unavailable',
        checks: result.checks,
      } };
    }
    return { data: { status: 'ready', checks: result.checks } };
  }
}
