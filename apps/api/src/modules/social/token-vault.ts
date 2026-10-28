import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

@Injectable()
export class TokenVault {
  constructor(private readonly config: ConfigService) {}
  private key() {
    const key = Buffer.from(this.config.get<string>('SOCIAL_TOKEN_ENCRYPTION_KEY') ?? '', 'base64');
    if (key.length !== 32) throw new Error('Social token encryption is not configured');
    return key;
  }
  encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const payload = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), payload.toString('base64url')].join('.');
  }
  decrypt(value: string) {
    const [version, iv, tag, payload] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !payload) throw new Error('Invalid social token envelope');
    const cipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(iv, 'base64url'));
    cipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([cipher.update(Buffer.from(payload, 'base64url')), cipher.final()]).toString('utf8');
  }
}
