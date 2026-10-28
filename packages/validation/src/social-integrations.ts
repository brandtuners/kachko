import { z } from 'zod';
import { linkUrlSchema } from './pages';

export const socialProviderSchema = z.enum(['instagram', 'youtube']);
export const socialAccountIdSchema = z.uuid();
export const socialAnalyticsQuerySchema = z.strictObject({ range: z.enum(['7d', '30d', '90d']).default('30d') });
const automationFields = {
  accountId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  triggerType: z.enum(['SPECIFIC_POST', 'ALL_POSTS', 'NEXT_POST']),
  mediaId: z.string().regex(/^\d{1,50}$/).nullable().optional(),
  matchType: z.enum(['ANY', 'KEYWORDS']),
  keywords: z.array(z.string().trim().toLowerCase().min(1).max(60)).max(20).default([]),
  message: z.string().trim().min(1).max(900),
  buttonLabel: z.string().trim().min(1).max(20),
  destinationUrl: linkUrlSchema,
  publicReply: z.string().trim().min(1).max(500).nullable().optional(),
  isActive: z.boolean().default(true),
};
function validateAutomation(value: { triggerType?: string; mediaId?: string | null; matchType?: string; keywords?: string[] }, ctx: z.RefinementCtx) {
  if (value.triggerType === 'SPECIFIC_POST' && !value.mediaId) ctx.addIssue({ code: 'custom', path: ['mediaId'], message: 'Choose a post or reel' });
  if (value.matchType === 'KEYWORDS' && !value.keywords?.length) ctx.addIssue({ code: 'custom', path: ['keywords'], message: 'Add at least one keyword' });
}
export const createDmAutomationSchema = z.strictObject(automationFields).superRefine(validateAutomation);
export const updateDmAutomationSchema = z.strictObject({ ...automationFields,
  keywords: automationFields.keywords.removeDefault(), isActive: automationFields.isActive.removeDefault() }).partial()
  .refine(value => Object.keys(value).length > 0, 'Provide at least one automation field');
export type CreateDmAutomationInput = z.output<typeof createDmAutomationSchema>;
export type UpdateDmAutomationInput = z.output<typeof updateDmAutomationSchema>;
