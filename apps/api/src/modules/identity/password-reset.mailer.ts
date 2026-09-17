import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PasswordResetMailer {
  private readonly logger = new Logger(PasswordResetMailer.name);
  constructor(private readonly config: ConfigService) {}

  async send(email: string, token: string) {
    const base = this.config.getOrThrow<string>('PUBLIC_APP_URL');
    const url = `${base}/reset-password?token=${encodeURIComponent(token)}`;
    const key = this.config.get<string>('RESEND_API_KEY');
    if (!key) {
      this.logger.log(`Development password reset for ${email}: ${url}`);
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': 'kachko-api/1.0' },
      body: JSON.stringify({
        from: this.config.getOrThrow<string>('EMAIL_FROM'), to: [email], subject: 'Reset your KACHKO password',
        html: `<p>Use the link below to reset your KACHKO password. It expires in one hour.</p><p><a href="${url}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      // Resend's response identifies configuration errors (invalid key,
      // unverified sender, restricted recipient) while never containing the
      // reset token. Keep a bounded diagnostic for operators; the API response
      // remains generic to callers.
      const details = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 500);
      this.logger.error(`Password reset email delivery failed with status ${response.status}${details ? `: ${details}` : ''}`);
      throw new Error('Password reset email delivery failed');
    }
  }
}
