import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';
import { IdentityModule } from '../identity/identity.module';
import { MediaController, PublicMediaController } from './media.controller';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { MediaStorage } from './media.storage';

@Module({
  imports: [DatabaseModule, RedisModule, IdentityModule],
  controllers: [MediaController, PublicMediaController],
  providers: [MediaRepository, MediaService, MediaStorage],
  exports: [MediaRepository],
})
export class MediaModule {}
