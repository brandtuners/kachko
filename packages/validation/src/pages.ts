import { themeKeySchema, themeConfigSchema, templateKeySchema } from './appearance';
import { socialPlatformSchema, publicSocialSchema } from './socials';
import { z } from 'zod';

/** Strict absolute HTTP(S) URLs; never fetch user-supplied destinations on the API. */
export const linkUrlSchema = z.string().max(2048).refine(value => {
  if (value !== value.trim() || /[\u0000-\u0020\u007f\\]/.test(value) || !/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}, 'Use an absolute HTTP(S) URL without credentials, spaces or control characters')
  .transform(value => new URL(value).href);

export const linkContentSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  url: linkUrlSchema,
  openInNewTab: z.boolean().default(true),
});
const pageFields = {
  title: z.string().trim().min(1).max(120).nullable().optional(),
  description: z.string().trim().max(300).nullable().optional(),
};
export const createPageSchema = z.strictObject({ ...pageFields, templateKey: templateKeySchema.optional() });
export const updatePageSchema = z.strictObject(pageFields)
  .refine(value => Object.keys(value).length > 0, 'Provide at least one page field');
export const createLinkBlockSchema = z.strictObject({
  type: z.literal('LINK'), content: linkContentSchema, isVisible: z.boolean().default(true),
});
export const updateLinkBlockSchema = z.strictObject({
  content: linkContentSchema.optional(), isVisible: z.boolean().optional(),
}).refine(value => Object.keys(value).length > 0, 'Provide content or visibility');
export const pageIdSchema = z.uuid();
export const blockIdSchema = z.uuid();

export type CreatePageInput = z.input<typeof createPageSchema>;
export type UpdatePageInput = z.input<typeof updatePageSchema>;
export type CreateLinkBlockInput = z.input<typeof createLinkBlockSchema>;
export type UpdateLinkBlockInput = z.input<typeof updateLinkBlockSchema>;
export type ValidatedLinkContent = z.output<typeof linkContentSchema>;

export const textContentSchema = z.strictObject({
  text: z.string().min(1).max(5000).refine(value => value.trim().length > 0, 'Text must not be blank'),
  alignment: z.enum(['left', 'center', 'right']).default('left'),
});
export const createTextBlockSchema = z.strictObject({
  type: z.literal('TEXT'), content: textContentSchema, isVisible: z.boolean().default(true),
});
export const imageContentSchema = z.strictObject({
  mediaId: z.uuid(),
  alt: z.string().trim().min(1).max(300),
  href: z.union([z.literal(''), linkUrlSchema]).optional(),
});
export const imageResponseContentSchema = imageContentSchema.extend({ url: z.string().max(2048) });
export const socialBlockContentSchema = z.strictObject({
  platform: socialPlatformSchema,
  username: z.string().trim().min(1).max(100).regex(/^@?[a-zA-Z0-9_.-]+$/, 'Use a profile handle, not a URL'),
});
export const dividerContentSchema = z.strictObject({});
export const youtubeContentSchema = z.strictObject({ videoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/, 'Use the 11-character YouTube video ID') });
export const spotifyContentSchema = z.strictObject({ url: linkUrlSchema.refine(value => {
  const url = new URL(value);
  return url.origin === 'https://open.spotify.com' && /^\/(track|playlist|album|episode|show|artist)\/[a-zA-Z0-9]{22}$/.test(url.pathname);
}, 'Use a Spotify track, playlist, album, episode, show or artist URL') });
export const emailContentSchema = z.strictObject({ email: z.email().max(254) });
export const phoneContentSchema = z.strictObject({ number: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{5,24}$/, 'Use a phone number with an optional country code') });
export const locationContentSchema = z.strictObject({ query: z.string().trim().min(1).max(300) });
export const blockContentSchemas = {
  LINK: linkContentSchema, TEXT: textContentSchema, IMAGE: imageContentSchema,
  SOCIAL: socialBlockContentSchema, DIVIDER: dividerContentSchema, YOUTUBE: youtubeContentSchema,
  SPOTIFY: spotifyContentSchema, EMAIL: emailContentSchema, PHONE: phoneContentSchema, LOCATION: locationContentSchema,
};
const extraBlocks = [
  z.strictObject({ type: z.literal('IMAGE'), content: blockContentSchemas.IMAGE, isVisible: z.boolean().default(true) }),
  z.strictObject({ type: z.literal('SOCIAL'), content: blockContentSchemas.SOCIAL, isVisible: z.boolean().default(true) }),
  z.strictObject({ type: z.literal('DIVIDER'), content: blockContentSchemas.DIVIDER, isVisible: z.boolean().default(true) }),
  z.strictObject({ type: z.literal('YOUTUBE'), content: blockContentSchemas.YOUTUBE, isVisible: z.boolean().default(true) }),
  z.strictObject({ type: z.literal('SPOTIFY'), content: blockContentSchemas.SPOTIFY, isVisible: z.boolean().default(true) }),
  z.strictObject({ type: z.literal('EMAIL'), content: blockContentSchemas.EMAIL, isVisible: z.boolean().default(true) }),
  z.strictObject({ type: z.literal('PHONE'), content: blockContentSchemas.PHONE, isVisible: z.boolean().default(true) }),
  z.strictObject({ type: z.literal('LOCATION'), content: blockContentSchemas.LOCATION, isVisible: z.boolean().default(true) }),
] as const;
export const createBlockSchema = z.discriminatedUnion('type', [createLinkBlockSchema, createTextBlockSchema, ...extraBlocks]);
export const updateTextBlockSchema = z.strictObject({
  content: textContentSchema.optional(), isVisible: z.boolean().optional(),
}).refine(value => Object.keys(value).length > 0, 'Provide content or visibility');
// The API additionally validates content against the stored block type under lock.
export const updateBlockSchema = z.strictObject({
  content: z.union([linkContentSchema, textContentSchema, imageContentSchema, socialBlockContentSchema, dividerContentSchema, youtubeContentSchema, spotifyContentSchema, emailContentSchema, phoneContentSchema, locationContentSchema]).optional(), isVisible: z.boolean().optional(),
}).refine(value => Object.keys(value).length > 0, 'Provide content or visibility');
export const reorderBlocksSchema = z.strictObject({
  items: z.array(z.strictObject({ id: z.uuid(), position: z.number().int().nonnegative() })),
}).superRefine(({ items }, ctx) => {
  if (new Set(items.map(item => item.id)).size !== items.length) {
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'Block IDs must be unique' });
  }
  const positions = items.map(item => item.position).sort((a, b) => a - b);
  if (positions.some((position, index) => position !== index)) {
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'Positions must be exactly 0 through items.length - 1' });
  }
});
export type CreateBlockInput = z.input<typeof createBlockSchema>;
export type UpdateBlockInput = z.input<typeof updateBlockSchema>;
export type ReorderBlocksInput = z.input<typeof reorderBlocksSchema>;
export type CreateTextBlockInput = z.input<typeof createTextBlockSchema>;
export type UpdateTextBlockInput = z.input<typeof updateTextBlockSchema>;
export type ValidatedTextContent = z.output<typeof textContentSchema>;
export const publicBlockSchema = z.discriminatedUnion('type', [
  z.strictObject({ id: z.uuid(), type: z.literal('LINK'), content: linkContentSchema }),
  z.strictObject({ id: z.uuid(), type: z.literal('TEXT'), content: textContentSchema }),
  z.strictObject({ id: z.uuid(), type: z.literal('IMAGE'), content: imageResponseContentSchema }),
  z.strictObject({ id: z.uuid(), type: z.literal('SOCIAL'), content: blockContentSchemas.SOCIAL }),
  z.strictObject({ id: z.uuid(), type: z.literal('DIVIDER'), content: blockContentSchemas.DIVIDER }),
  z.strictObject({ id: z.uuid(), type: z.literal('YOUTUBE'), content: blockContentSchemas.YOUTUBE }),
  z.strictObject({ id: z.uuid(), type: z.literal('SPOTIFY'), content: blockContentSchemas.SPOTIFY }),
  z.strictObject({ id: z.uuid(), type: z.literal('EMAIL'), content: blockContentSchemas.EMAIL }),
  z.strictObject({ id: z.uuid(), type: z.literal('PHONE'), content: blockContentSchemas.PHONE }),
  z.strictObject({ id: z.uuid(), type: z.literal('LOCATION'), content: blockContentSchemas.LOCATION }),
]);
/** Cache/public response allowlist; strict parsing prevents accidental private fields. */
export const publicPageSchema = z.strictObject({
  profile: z.strictObject({ username: z.string(), displayName: z.string().nullable(), bio: z.string().nullable(), avatarUrl: z.string().nullable() }),
  page: z.strictObject({ id: z.uuid(), title: z.string().nullable(), description: z.string().nullable(), themeKey: themeKeySchema, appearance: themeConfigSchema }),
  blocks: z.array(publicBlockSchema),
  socials: z.array(publicSocialSchema),
});
