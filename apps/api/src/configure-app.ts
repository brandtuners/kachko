import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { raw } from 'express';
import { MEDIA_MAX_BYTES, MEDIA_MIME_TYPES } from '@kachko/validation';
import { HttpExceptionFilter } from './common/http-exception.filter';

export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.use('/api/v1/media/uploads', raw({ type: [...MEDIA_MIME_TYPES], limit: MEDIA_MAX_BYTES }));
  app.use(helmet());
  app.enableCors({ origin: config.getOrThrow<string[]>('CORS_ORIGINS'), credentials: true, allowedHeaders: ['Content-Type', 'X-Kachko-CSRF'], exposedHeaders: ['Retry-After'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  if (config.get<string>('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder()
      .setTitle('kachko API').setVersion('1').addCookieAuth(config.getOrThrow<string>('SESSION_COOKIE_NAME')).build());
    SwaggerModule.setup('api/docs', app, document);
  }
}
