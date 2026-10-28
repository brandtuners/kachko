import { z } from 'zod';
import { linkUrlSchema } from './pages';

export const shortLinkCodeSchema = z.string().min(3).max(48).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, underscores or hyphens');
const utmValue = z.string().trim().min(1).max(120).refine(value => !/[\u0000-\u001f\u007f]/.test(value), 'UTM values cannot contain control characters');
export const shortLinkUtmSchema = z.strictObject({ source: utmValue.optional(), medium: utmValue.optional(),
  campaign: utmValue.optional(), term: utmValue.optional(), content: utmValue.optional() });
export function shortLinkDestination(destination: string, utm: z.infer<typeof shortLinkUtmSchema> = {}) {
  const url = new URL(destination);
  for (const [key, value] of Object.entries(shortLinkUtmSchema.parse(utm))) if (value) url.searchParams.set(`utm_${key}`, value);
  return url.href;
}
export const createShortLinkSchema = z.strictObject({
  title: z.string().trim().max(120).nullable().optional(),
  destinationUrl: linkUrlSchema,
  utm: shortLinkUtmSchema.optional(),
  code: shortLinkCodeSchema.optional(),
  channel: z.string().trim().max(80).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});
export const updateShortLinkSchema = z.strictObject({
  title: z.string().trim().max(120).nullable().optional(),
  destinationUrl: linkUrlSchema.optional(),
  utm: shortLinkUtmSchema.optional(),
  isActive: z.boolean().optional(),
  code: shortLinkCodeSchema.optional(),
  channel: z.string().trim().max(80).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
}).refine(value => Object.keys(value).length > 0, 'Provide a title, destination or status');
export const shortLinkListSchema = z.strictObject({ cursor: z.uuid().optional() });
export type CreateShortLinkInput = z.infer<typeof createShortLinkSchema>;
export type UpdateShortLinkInput = z.infer<typeof updateShortLinkSchema>;
