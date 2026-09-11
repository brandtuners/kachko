import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const details = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {};
    const message = status >= 500 ? 'Internal server error' : details.message ?? body ?? 'Request failed';
    if (status >= 500) this.logger.error('Unhandled server error', exception instanceof Error ? exception.stack : undefined);
    host.switchToHttp().getResponse<Response>().status(status).json({
      error: {
        code: typeof details.code === 'string' ? details.code : status >= 500 ? 'INTERNAL_ERROR' : HttpStatus[status] ?? 'REQUEST_FAILED',
        message,
      },
    });
  }
}
