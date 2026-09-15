import { z } from 'zod';

export const socialPlatformSchema = z.enum(['INSTAGRAM', 'YOUTUBE', 'X', 'LINKEDIN', 'FACEBOOK', 'TIKTOK', 'GITHUB', 'DISCORD', 'TWITCH', 'SPOTIFY']);
export const SOCIAL_HOSTS: Record<z.infer<typeof socialPlatformSchema>, readonly string[]> = {
  INSTAGRAM: ['instagram.com'], YOUTUBE: ['youtube.com', 'youtu.be'], X: ['x.com', 'twitter.com'],
  LINKEDIN: ['linkedin.com'], FACEBOOK: ['facebook.com', 'fb.com'], TIKTOK: ['tiktok.com'],
  GITHUB: ['github.com'], DISCORD: ['discord.com', 'discord.gg'], TWITCH: ['twitch.tv'], SPOTIFY: ['spotify.com'],
};
const urlSchema = z.string().max(2048).refine(value => {
  if (value !== value.trim() || /[\u0000-\u0020\u007f\\]/.test(value) || !/^https?:\/\//i.test(value)) return false;
  try { const url = new URL(value); return Boolean(url.hostname) && !url.username && !url.password && !url.port; }
  catch { return false; }
}, 'Use an absolute HTTP(S) social URL without credentials, whitespace or custom ports').transform(value => new URL(value).href);
const fields = {
  platform: socialPlatformSchema, url: urlSchema,
  username: z.string().trim().min(1).max(100).nullable().optional(),
  isVisible: z.boolean().optional(),
};
function matchesPlatform(value: { platform: z.infer<typeof socialPlatformSchema>; url: string }) {
  // Object refinements can run even when an individual URL check has failed.
  try {
    const hostname = new URL(value.url).hostname;
    return SOCIAL_HOSTS[value.platform]?.some(host => hostname === host || hostname.endsWith(`.${host}`)) ?? false;
  } catch { return false; }
}
export const socialDataSchema = z.strictObject(fields).refine(matchesPlatform, { path: ['url'], message: 'URL host must match the selected platform' });
export const createSocialSchema = socialDataSchema;
export const updateSocialSchema = z.strictObject({
  platform: fields.platform.optional(), url: fields.url.optional(), username: fields.username, isVisible: fields.isVisible,
}).refine(value => Object.keys(value).length > 0, 'Provide at least one social field');
export const publicSocialSchema = z.strictObject({ id: z.uuid(), platform: socialPlatformSchema, username: z.string().nullable(), url: urlSchema }).refine(matchesPlatform, { path: ['url'], message: 'URL host must match the selected platform' });
export type CreateSocialInput = z.input<typeof createSocialSchema>;
export type UpdateSocialInput = z.input<typeof updateSocialSchema>;
