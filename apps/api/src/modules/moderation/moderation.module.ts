import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { MediaModule } from '../media/media.module';
import { RedisModule } from '../../redis/redis.module';
import { AccountDeletionController, ModerationController } from './moderation.controller';
import { AdminGuard, StaffGuard } from './moderation.guard';
import { ModerationService } from './moderation.service';

@Module({
  imports: [DatabaseModule, RedisModule, IdentityModule, MediaModule],
  controllers: [ModerationController, AccountDeletionController],
  providers: [ModerationService, StaffGuard, AdminGuard],
})
export class ModerationModule {}
