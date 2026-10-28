import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { DatabaseModule } from '../../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { ShortLinksController, PublicShortLinksController } from './short-links.controller';
import { ShortLinksRepository } from './short-links.repository';
import { ShortLinksService } from './short-links.service';

@Module({ imports: [DatabaseModule, RedisModule, IdentityModule], controllers: [ShortLinksController, PublicShortLinksController],
  providers: [ShortLinksRepository, ShortLinksService] })
export class ShortLinksModule {}
