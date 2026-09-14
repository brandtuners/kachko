import { PagesModule } from './modules/pages/pages.module';
import { IdentityModule } from './modules/identity/identity.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.NODE_ENV === 'test', validate: validateEnvironment }),
    HealthModule,
    IdentityModule,
    PagesModule,
  ],
})
export class AppModule {}
