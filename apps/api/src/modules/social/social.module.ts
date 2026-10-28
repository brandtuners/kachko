import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';
import { IdentityModule } from '../identity/identity.module';
import { SocialController, SocialPublicController } from './social.controller';
import { SocialService } from './social.service';
import { InstagramProvider } from './instagram.provider';
import { YoutubeProvider } from './youtube.provider';
import { TokenVault } from './token-vault';

@Module({ imports: [DatabaseModule, RedisModule, IdentityModule], controllers: [SocialController, SocialPublicController],
  providers: [SocialService, InstagramProvider, YoutubeProvider, TokenVault] })
export class SocialModule {}
