import { z } from 'zod';

export const reportReasonSchema = z.enum(['SPAM', 'HARASSMENT', 'IMPERSONATION', 'ILLEGAL_CONTENT', 'OTHER']);
export const reportStatusSchema = z.enum(['OPEN', 'RESOLVED', 'REJECTED']);
export const createReportSchema = z.strictObject({
  pageId: z.string().uuid(),
  reason: reportReasonSchema,
  details: z.string().trim().min(10).max(2000).optional(),
});
export const reportStatusUpdateSchema = z.strictObject({ status: z.enum(['RESOLVED', 'REJECTED']) });
export const userStatusUpdateSchema = z.strictObject({ isActive: z.boolean() });
export const deleteAccountSchema = z.strictObject({
  confirmation: z.literal('DELETE'),
  password: z.string().min(1).max(128).optional(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ReportStatusUpdateInput = z.infer<typeof reportStatusUpdateSchema>;
export type UserStatusUpdateInput = z.infer<typeof userStatusUpdateSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
