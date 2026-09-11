import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/http-exception.filter';

export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({ origin: config.getOrThrow<string[]>('CORS_ORIGINS'), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  if (config.get<string>('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder()
      .setTitle('Kachko API').setVersion('1').build());
    SwaggerModule.setup('api/docs', app, document);
  }
}
