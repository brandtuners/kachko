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
import { CsrfGuard, IdentityRateGuard, SessionGuard } from './identity.guards';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [AuthController, UsersController, GoogleController],
  providers: [GoogleService, GoogleProvider, IdentityService, IdentityRepository, IdentityRateGuard, SessionGuard,
    { provide: APP_GUARD, useClass: CsrfGuard }],
})
export class IdentityModule {}
