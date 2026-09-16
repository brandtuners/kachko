import { z } from 'zod';

export const analyticsEventTypeSchema = z.enum(['PAGE_VIEW', 'LINK_CLICK', 'SOCIAL_CLICK']);
export const analyticsEventSchema = z.strictObject({
  pageId: z.uuid(),
  blockId: z.uuid().optional(),
  socialProfileId: z.uuid().optional(),
  eventType: analyticsEventTypeSchema,
}).superRefine((value, ctx) => {
  if (value.eventType === 'PAGE_VIEW' && (value.blockId || value.socialProfileId)) {
    ctx.addIssue({ code: 'custom', path: ['blockId'], message: 'PAGE_VIEW must not include a target ID' });
  }
  if (value.eventType === 'LINK_CLICK' && (!value.blockId || value.socialProfileId)) {
    ctx.addIssue({ code: 'custom', path: ['blockId'], message: 'LINK_CLICK requires only blockId' });
  }
  if (value.eventType === 'SOCIAL_CLICK' && Number(Boolean(value.blockId)) + Number(Boolean(value.socialProfileId)) !== 1) {
    ctx.addIssue({ code: 'custom', path: ['socialProfileId'], message: 'SOCIAL_CLICK requires exactly one blockId or socialProfileId' });
  }
});
export const analyticsRangeSchema = z.strictObject({
  range: z.enum(['today', '7d', '30d']).default('7d'),
});
export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;
export type AnalyticsRangeInput = z.infer<typeof analyticsRangeSchema>;
