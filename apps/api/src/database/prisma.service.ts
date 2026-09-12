import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  private readonly serviceLogger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    const timeout = config.getOrThrow<number>('DEPENDENCY_TIMEOUT_MS');
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
        connectionTimeoutMillis: timeout,
        query_timeout: timeout,
        statement_timeout: timeout,
        max: 10,
      }),
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      await this.ping();
    } catch {
      // Keep liveness available; readiness probes retry the database when it recovers.
      this.serviceLogger.warn('PostgreSQL is unavailable at startup; readiness will report unavailable.');
    }
  }

  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }

  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
