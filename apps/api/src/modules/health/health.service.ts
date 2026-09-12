import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

type DependencyStatus = 'up' | 'down';
export type Readiness = { ready: boolean; checks: { postgres: DependencyStatus; redis: DependencyStatus } };

@Injectable()
export class HealthService implements OnModuleDestroy {
  private stopping = false;
  private pending?: Promise<Readiness>;
  private readonly timeout: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.timeout = config.getOrThrow<number>('DEPENDENCY_TIMEOUT_MS');
  }

  onModuleDestroy() { this.stopping = true; }

  async readiness(): Promise<Readiness> {
    if (this.stopping) return { ready: false, checks: { postgres: 'down', redis: 'down' } };
    // Concurrent probes share one check; never cache a completed success.
    this.pending ??= this.checkDependencies().finally(() => { this.pending = undefined; });
    return this.pending;
  }

  private async checkDependencies(): Promise<Readiness> {
    const [postgres, redis] = await Promise.all([
      this.check(() => this.prisma.ping()),
      this.check(() => this.redis.ping()),
    ]);
    return { ready: !this.stopping && postgres === 'up' && redis === 'up', checks: { postgres, redis } };
  }

  private async check(probe: () => Promise<void>): Promise<DependencyStatus> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.resolve().then(probe),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Dependency probe timed out')), this.timeout);
        }),
      ]);
      return 'up';
    } catch {
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }
}
