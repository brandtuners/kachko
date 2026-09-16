import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { CompleteMediaUploadInput, RequestMediaUploadInput } from '@kachko/validation';
import { MEDIA_MAX_BYTES, MEDIA_MAX_DIMENSION } from '@kachko/validation';
import type { MediaAsset, MediaUploadTarget } from '@kachko/types';
import { RedisService } from '../../redis/redis.service';
import { identityError } from '../identity/identity.service';
import { MediaRepository } from './media.repository';
import { MediaStorage } from './media.storage';

type Intent = { userId: string; mimeType: string; size: number; forAvatar: boolean };
const formats = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' } as const;

@Injectable()
export class MediaService {
  constructor(private readonly repository: MediaRepository, private readonly storage: MediaStorage,
    private readonly redis: RedisService, private readonly config: ConfigService) {}
  private key(storageKey: string) { return `media-upload:${storageKey}`; }
  private client() { return this.redis.client.withCommandOptions({ abortSignal: AbortSignal.timeout(this.config.getOrThrow<number>('DEPENDENCY_TIMEOUT_MS')) }); }
  private dto(media: { id: string; url: string; mimeType: string; size: bigint; width: number; height: number; createdAt: Date }): MediaAsset {
    return { id: media.id, url: media.url, mimeType: media.mimeType as MediaAsset['mimeType'], size: Number(media.size),
      width: media.width, height: media.height, createdAt: media.createdAt.toISOString() };
  }
  private async intent(storageKey: string): Promise<Intent> {
    try {
      const raw = await this.client().get(this.key(storageKey));
      if (!raw) identityError(404, 'UPLOAD_NOT_FOUND', 'Upload authorization expired or was not found');
      return JSON.parse(raw) as Intent;
    } catch (error) {
      if (error && typeof error === 'object' && 'getStatus' in error) throw error;
      identityError(503, 'DEPENDENCIES_UNAVAILABLE', 'Required services are unavailable');
    }
  }
  async authorize(userId: string, input: RequestMediaUploadInput): Promise<{ data: MediaUploadTarget }> {
    const storageKey = randomUUID();
    const intent: Intent = { userId, mimeType: input.mimeType, size: input.size, forAvatar: input.forAvatar ?? false };
    try { await this.client().set(this.key(storageKey), JSON.stringify(intent), { EX: 900 }); }
    catch { identityError(503, 'DEPENDENCIES_UNAVAILABLE', 'Required services are unavailable'); }
    const target = await this.storage.target(storageKey, intent.mimeType, intent.size);
    return { data: { storageKey, uploadUrl: target.uploadUrl, method: 'PUT', headers: target.headers,
      expiresAt: new Date(Date.now() + 900_000).toISOString() } };
  }
  async acceptLocal(userId: string, storageKey: string, mimeType: string | undefined, bytes: unknown) {
    if (!this.storage.isLocal()) identityError(404, 'UPLOAD_NOT_FOUND', 'Local upload route is disabled');
    const intent = await this.intent(storageKey);
    if (intent.userId !== userId) identityError(404, 'UPLOAD_NOT_FOUND', 'Upload not found');
    if (mimeType !== intent.mimeType || !Buffer.isBuffer(bytes) || bytes.length !== intent.size || bytes.length > MEDIA_MAX_BYTES) {
      identityError(400, 'UPLOAD_MISMATCH', 'Uploaded bytes must match the authorized MIME type and size');
    }
    try { await this.storage.putLocal(storageKey, bytes); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') identityError(409, 'UPLOAD_ALREADY_RECEIVED', 'Upload bytes were already received');
      throw error;
    }
  }
  async complete(userId: string, input: CompleteMediaUploadInput) {
    const existing = await this.repository.byStorageKey(input.storageKey);
    if (existing) {
      if (existing.userId !== userId) identityError(404, 'UPLOAD_NOT_FOUND', 'Upload not found');
      return { data: this.dto(existing) };
    }
    const intent = await this.intent(input.storageKey);
    if (intent.userId !== userId || (input.forAvatar ?? false) !== intent.forAvatar) identityError(404, 'UPLOAD_NOT_FOUND', 'Upload not found');
    let bytes: Buffer;
    try { bytes = await this.storage.read(input.storageKey); }
    catch { identityError(400, 'UPLOAD_INCOMPLETE', 'Upload the file before completing it'); }
    if (bytes.length !== intent.size || bytes.length > MEDIA_MAX_BYTES) return this.reject(input.storageKey, 'Uploaded size does not match authorization');
    let metadata: Awaited<ReturnType<sharp.Sharp['metadata']>>;
    try { metadata = await sharp(bytes, { animated: true, limitInputPixels: MEDIA_MAX_DIMENSION ** 2 }).metadata(); }
    catch { return this.reject(input.storageKey, 'Uploaded bytes are not a supported image'); }
    const mimeType = metadata.format ? formats[metadata.format as keyof typeof formats] : undefined;
    const width = metadata.width; const height = metadata.height;
    if (!mimeType || mimeType !== intent.mimeType || !width || !height || width > MEDIA_MAX_DIMENSION || height > MEDIA_MAX_DIMENSION) {
      return this.reject(input.storageKey, 'Image type or dimensions do not match the allowed upload');
    }
    if ((input.width !== undefined && input.width !== width) || (input.height !== undefined && input.height !== height)) {
      return this.reject(input.storageKey, 'Image dimensions do not match the uploaded bytes');
    }
    const id = randomUUID();
    const created = await this.repository.create(userId, { id, storageKey: input.storageKey,
      url: this.storage.publicUrl(id, input.storageKey), mimeType, size: bytes.length, width, height }, intent.forAvatar);
    await this.client().del(this.key(input.storageKey));
    if (created.replacedStorageKey) await this.storage.delete(created.replacedStorageKey).catch(() => undefined);
    return { data: this.dto(created.media) };
  }
  private async reject(storageKey: string, message: string): Promise<never> {
    await Promise.allSettled([this.storage.delete(storageKey), this.client().del(this.key(storageKey))]);
    identityError(400, 'INVALID_MEDIA', message);
  }
  async list(userId: string) { return { data: (await this.repository.list(userId)).map(media => this.dto(media)) }; }
  async owned(userId: string, id: string) {
    const media = await this.repository.findOwned(userId, id);
    if (!media) identityError(404, 'MEDIA_NOT_FOUND', 'Media not found');
    return { data: this.dto(media) };
  }
  async publicFile(id: string) {
    const media = await this.repository.public(id);
    if (!media) identityError(404, 'MEDIA_NOT_FOUND', 'Media not found');
    try { return { media, bytes: await this.storage.read(media.storageKey) }; }
    catch { identityError(404, 'MEDIA_NOT_FOUND', 'Media file not found'); }
  }
  async delete(userId: string, id: string) {
    const media = await this.repository.findOwned(userId, id);
    if (!media) identityError(404, 'MEDIA_NOT_FOUND', 'Media not found');
    if (await this.repository.usage(userId, id)) identityError(409, 'MEDIA_IN_USE', 'Detach this media from avatars and blocks before deleting it');
    await this.repository.delete(userId, id);
    // The database remains authoritative. Storage lifecycle cleanup can remove
    // an orphan if an external provider is temporarily unavailable here.
    await this.storage.delete(media.storageKey).catch(() => undefined);
    return { data: { deleted: true as const } };
  }
  async clearAvatar(userId: string) {
    const removed = await this.repository.removeAvatar(userId);
    if (removed.storageKey) {
      // The metadata is removed transactionally first. A storage lifecycle rule
      // remains the fallback if the provider is temporarily unavailable.
      await this.storage.delete(removed.storageKey).catch(() => undefined);
    }
    return { data: { cleared: true as const, deleted: Boolean(removed.storageKey) } };
  }
}
