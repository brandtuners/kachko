import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  await app.listen(config.getOrThrow<number>('PORT'));
}

void bootstrap().catch((error: unknown) => {
  Logger.error(error, undefined, 'Bootstrap');
  process.exitCode = 1;
});
