import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { publicPageSchema } from '@kachko/validation';
import type { PublicPage } from '@kachko/types';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class PublicPageCache {
  constructor(private readonly redis: RedisService, private readonly config: ConfigService) {}
  private client() {
    return this.redis.client.withCommandOptions({ abortSignal: AbortSignal.timeout(this.config.getOrThrow<number>('DEPENDENCY_TIMEOUT_MS')) });
  }
  key(username: string, page: { id: string; revision: number }) { return `page:${username}:${page.id}:${page.revision}`; }
  async get(key: string): Promise<PublicPage | null> {
    try {
      if (!this.redis.client.isReady) return null;
      const value = await this.client().get(key);
      return value ? publicPageSchema.parse(JSON.parse(value)) : null;
    } catch { return null; }
  }
  async set(key: string, value: PublicPage) {
    try {
      if (this.redis.client.isReady) await this.client().set(key, JSON.stringify(value), { EX: 60 });
    } catch { /* Cache failure must not prevent a database-backed public read. */ }
  }
}
