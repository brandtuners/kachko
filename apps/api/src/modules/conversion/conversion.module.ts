import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';
import { IdentityModule } from '../identity/identity.module';
import { AudienceController, FormsController, PublicFormsController } from './conversion.controller';
import { ConversionRepository } from './conversion.repository';
import { ConversionService } from './conversion.service';

@Module({ imports: [DatabaseModule, RedisModule, IdentityModule], controllers: [FormsController, PublicFormsController, AudienceController], providers: [ConversionRepository, ConversionService] })
export class ConversionModule {}
