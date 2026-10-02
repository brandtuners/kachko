import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';
import { IdentityModule } from '../identity/identity.module';
import { AnalyticsIngestionController, AnalyticsQueryController, ConversionAnalyticsController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [DatabaseModule, RedisModule, IdentityModule],
  controllers: [AnalyticsIngestionController, AnalyticsQueryController, ConversionAnalyticsController],
  providers: [AnalyticsRepository, AnalyticsService],
})
export class AnalyticsModule {}
