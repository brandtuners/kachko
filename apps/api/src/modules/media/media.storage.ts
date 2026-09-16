import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface UploadTarget { uploadUrl: string; headers: Record<string, string> }

@Injectable()
export class MediaStorage {
  private readonly mode: 'local' | 'r2';
  private readonly localDir: string;
  private readonly s3?: S3Client;
  private readonly bucket?: string;
  constructor(private readonly config: ConfigService) {
    this.mode = config.getOrThrow<'local' | 'r2'>('MEDIA_STORAGE');
    this.localDir = config.getOrThrow<string>('MEDIA_LOCAL_DIR');
    if (this.mode === 'r2') {
      const account = config.getOrThrow<string>('R2_ACCOUNT_ID');
      this.bucket = config.getOrThrow<string>('R2_BUCKET');
      this.s3 = new S3Client({ region: 'auto', endpoint: `https://${account}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: config.getOrThrow<string>('R2_ACCESS_KEY_ID'), secretAccessKey: config.getOrThrow<string>('R2_SECRET_ACCESS_KEY') } });
    }
  }
  isLocal() { return this.mode === 'local'; }
  private path(key: string) { return join(this.localDir, key); }
  async target(key: string, mimeType: string, size: number): Promise<UploadTarget> {
    if (this.mode === 'local') return { uploadUrl: `/api/v1/media/uploads/${key}`, headers: { 'Content-Type': mimeType, 'X-Kachko-CSRF': '1' } };
    const uploadUrl = await getSignedUrl(this.s3!, new PutObjectCommand({ Bucket: this.bucket!, Key: key, ContentType: mimeType, ContentLength: size }), { expiresIn: 900 });
    return { uploadUrl, headers: { 'Content-Type': mimeType } };
  }
  async putLocal(key: string, bytes: Buffer) {
    if (this.mode !== 'local') throw new Error('Local upload route is disabled');
    await mkdir(this.localDir, { recursive: true });
    await writeFile(this.path(key), bytes, { flag: 'wx', mode: 0o600 });
  }
  async read(key: string): Promise<Buffer> {
    if (this.mode === 'local') return readFile(this.path(key));
    const result = await this.s3!.send(new GetObjectCommand({ Bucket: this.bucket!, Key: key }));
    if (!result.Body) throw new Error('Stored object has no body');
    return Buffer.from(await result.Body.transformToByteArray());
  }
  async delete(key: string) {
    if (this.mode === 'local') { try { await unlink(this.path(key)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } return; }
    await this.s3!.send(new DeleteObjectCommand({ Bucket: this.bucket!, Key: key }));
  }
  publicUrl(mediaId: string, key: string) {
    return this.mode === 'local' ? `/api/v1/media/files/${mediaId}` : `${this.config.getOrThrow<string>('R2_PUBLIC_URL').replace(/\/$/, '')}/${key}`;
  }
}
