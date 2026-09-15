import { AppearanceCatalogController, PageAppearanceController } from './appearance.controller';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';
import { IdentityModule } from '../identity/identity.module';
import { PagesController, PublicPagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { PagesRepository } from './pages.repository';
import { PublicPageCache } from './public-page.cache';

@Module({
  imports: [DatabaseModule, RedisModule, IdentityModule],
  controllers: [PagesController, PublicPagesController, AppearanceCatalogController, PageAppearanceController],
  providers: [PagesService, PagesRepository, PublicPageCache],
})
export class PagesModule {}
