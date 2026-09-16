import { z } from 'zod';

export const MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const MEDIA_MAX_DIMENSION = 4096;

export const requestMediaUploadSchema = z.strictObject({
  mimeType: z.enum(MEDIA_MIME_TYPES),
  size: z.number().int().positive().max(MEDIA_MAX_BYTES),
  forAvatar: z.boolean().default(false),
});
export const completeMediaUploadSchema = z.strictObject({
  storageKey: z.string().uuid(),
  // Hints are checked against decoded bytes; they are never trusted.
  width: z.number().int().positive().max(MEDIA_MAX_DIMENSION).optional(),
  height: z.number().int().positive().max(MEDIA_MAX_DIMENSION).optional(),
  forAvatar: z.boolean().default(false),
});
export const mediaIdSchema = z.uuid();
export type RequestMediaUploadInput = z.input<typeof requestMediaUploadSchema>;
export type CompleteMediaUploadInput = z.input<typeof completeMediaUploadSchema>;
