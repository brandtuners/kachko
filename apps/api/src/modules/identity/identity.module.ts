import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { GoogleProvider } from './google.provider';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';
import { AuthController, UsersController } from './identity.controller';
import { IdentityService } from './identity.service';
import { IdentityRepository } from './identity.repository';
import { CsrfGuard, FeatureGuard, IdentityRateGuard, SessionGuard } from './identity.guards';
import { PasswordResetMailer } from './password-reset.mailer';
import { ClerkIdentityService } from './clerk-identity.service';
import { ClerkWebhookController } from './clerk-webhook.controller';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [AuthController, UsersController, GoogleController, ClerkWebhookController],
  exports: [SessionGuard, FeatureGuard, IdentityRateGuard, IdentityService, ClerkIdentityService],
  providers: [GoogleService, GoogleProvider, PasswordResetMailer, ClerkIdentityService, IdentityService, IdentityRepository, IdentityRateGuard, SessionGuard, FeatureGuard,
    { provide: APP_GUARD, useClass: CsrfGuard }],
})
export class IdentityModule {}
