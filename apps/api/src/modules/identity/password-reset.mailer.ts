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
        html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reset your KACHKO password</title></head>
<body style="margin:0;background:#f4f6ef;color:#111312;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Securely reset your KACHKO password.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6ef;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e6dc;border-radius:20px;overflow:hidden;">
        <tr><td style="height:6px;background:#b5ed2b;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 36px 24px;">
          <div style="font-size:24px;line-height:1;font-weight:800;letter-spacing:2px;color:#111312;"><span style="display:inline-block;width:16px;height:12px;margin-right:9px;border:4px solid #b5ed2b;border-bottom:0;border-radius:14px 14px 0 0;vertical-align:2px;">&nbsp;</span>KACH<span style="color:#8cae16;">K</span>O</div>
          <div style="margin-top:8px;font-size:11px;letter-spacing:3px;color:#7b8279;">ONE LINK FOR A BRIGHTER YOU</div>
        </td></tr>
        <tr><td style="padding:8px 36px 36px;">
          <h1 style="margin:0 0 14px;font-size:30px;line-height:1.2;letter-spacing:-.5px;color:#111312;">Reset your password</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#596158;">We received a request to reset your KACHKO password. Click the button below to choose a new one.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:999px;background:#b5ed2b;"><a href="${url}" style="display:inline-block;padding:14px 26px;border-radius:999px;color:#111312;font-size:15px;font-weight:700;text-decoration:none;">Reset password&nbsp; &rarr;</a></td></tr></table>
          <p style="margin:24px 0 0;padding:14px 16px;border-radius:10px;background:#f4f6ef;color:#596158;font-size:13px;line-height:1.5;">This link expires in one hour and can be used only once.</p>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#7b8279;">If you didn’t request this, you can safely ignore this email. Your password will not change.</p>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid #edf0e9;color:#8b9289;font-size:12px;line-height:1.6;">
          <strong style="color:#596158;">KACHKO</strong><br>Build a brighter you.<br>
          <a href="${base}/privacy" style="color:#596158;">Privacy</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="${base}/terms" style="color:#596158;">Terms</a>
        </td></tr>
      </table>
      <p style="margin:18px 0 0;color:#9aa198;font-size:11px;">&copy; ${new Date().getUTCFullYear()} KACHKO. All rights reserved.</p>
    </td></tr>
  </table>
</body></html>`,
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
