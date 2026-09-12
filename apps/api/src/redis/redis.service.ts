import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  readonly client: RedisClientType;
  private readonly logger = new Logger(RedisService.name);
  private readonly timeout: number;
  private unavailableLogged = false;

  constructor(config: ConfigService) {
    this.timeout = config.getOrThrow<number>('DEPENDENCY_TIMEOUT_MS');
    this.client = createClient({
      url: config.getOrThrow<string>('REDIS_URL'),
      socket: { connectTimeout: this.timeout },
      disableOfflineQueue: true,
      commandsQueueMaxLength: 100,
    });
    // node-redis requires an error listener. Never log connection URLs or raw errors.
    this.client.on('error', () => {
      if (!this.unavailableLogged) this.logger.warn('Redis is unavailable; reconnecting.');
      this.unavailableLogged = true;
    });
    this.client.on('ready', () => { this.unavailableLogged = false; });
  }

  onModuleInit() {
    // Automatic reconnect may continue indefinitely; it must not prevent HTTP startup.
    void this.client.connect().catch(() => {
      if (!this.unavailableLogged) this.logger.warn('Redis connection could not be established.');
      this.unavailableLogged = true;
    });
  }

  async ping(): Promise<void> {
    if (!this.client.isReady) throw new Error('Redis is not ready');
    const reply = await this.client.withCommandOptions({
      abortSignal: AbortSignal.timeout(this.timeout),
    }).ping();
    if (reply !== 'PONG') throw new Error('Unexpected Redis health response');
  }

  onApplicationShutdown() {
    // Nest has drained HTTP requests before this hook. Close the socket and stop
    // reconnecting even when Redis is offline; no unbounded command drain on exit.
    if (this.client.isOpen) this.client.destroy();
  }
}
