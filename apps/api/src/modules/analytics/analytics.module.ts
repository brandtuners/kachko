import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';
import { IdentityModule } from '../identity/identity.module';
import { AnalyticsIngestionController, AnalyticsQueryController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [DatabaseModule, RedisModule, IdentityModule],
  controllers: [AnalyticsIngestionController, AnalyticsQueryController],
  providers: [AnalyticsRepository, AnalyticsService],
})
export class AnalyticsModule {}
