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
export const createPageSchema = z.strictObject(pageFields);
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

/** Cache/public response allowlist; strict parsing prevents accidental private fields. */
export const publicPageSchema = z.strictObject({
  profile: z.strictObject({ username: z.string(), displayName: z.string().nullable(), bio: z.string().nullable(), avatarUrl: z.string().nullable() }),
  page: z.strictObject({ title: z.string().nullable(), description: z.string().nullable(), themeKey: z.literal('minimal') }),
  blocks: z.array(z.strictObject({ id: z.uuid(), type: z.literal('LINK'), content: linkContentSchema })),
});
