import { z } from 'zod';
import { emailSchema } from './index';
import { linkUrlSchema } from './pages';

export const formIdSchema = z.uuid();
export const contactIdSchema = z.uuid();
export const fieldIdSchema = z.uuid();
export const tagIdSchema = z.uuid();
export const formFieldTypeSchema = z.enum(['TEXT', 'EMAIL', 'PHONE', 'TEXTAREA', 'SELECT', 'CHECKBOX']);
export const fieldNameSchema = z.string().trim().toLowerCase().min(1).max(40).regex(/^[a-z][a-z0-9_]*$/);
const fieldConfigSchema = z.strictObject({ options: z.array(z.string().trim().min(1).max(80)).min(1).max(20).optional() }).nullable().optional();
const formShape = {
  name: z.string().trim().min(1).max(80), title: z.string().trim().min(1).max(120).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(), submitLabel: z.string().trim().min(1).max(40).default('Submit'),
  successType: z.enum(['MESSAGE', 'REDIRECT']).default('MESSAGE'),
  successConfig: z.strictObject({ message: z.string().trim().min(1).max(300).optional(), url: linkUrlSchema.optional() }).nullable().optional(),
  isActive: z.boolean().default(true),
};
export const createFormSchema = z.strictObject(formShape).superRefine((value, ctx) => {
  if (value.successType === 'REDIRECT' && !value.successConfig?.url) ctx.addIssue({ code: 'custom', path: ['successConfig', 'url'], message: 'Redirect forms require a URL' });
});
export const updateFormSchema = z.strictObject(Object.fromEntries(Object.entries(formShape).map(([key, schema]) => [key, schema.optional()])) as { [K in keyof typeof formShape]: z.ZodOptional<(typeof formShape)[K]> })
  .refine(value => Object.keys(value).length > 0, 'Provide at least one form field');
const formFieldBaseSchema = z.strictObject({
  type: formFieldTypeSchema, label: z.string().trim().min(1).max(80), name: fieldNameSchema,
  placeholder: z.string().trim().max(120).nullable().optional(), required: z.boolean().default(false), config: fieldConfigSchema,
});
export const createFormFieldSchema = formFieldBaseSchema.superRefine((value, ctx) => {
  if (value.type === 'SELECT' && !value.config?.options?.length) ctx.addIssue({ code: 'custom', path: ['config', 'options'], message: 'Select fields require options' });
});
export const updateFormFieldSchema = formFieldBaseSchema.partial().refine(value => Object.keys(value).length > 0, 'Provide at least one field property');
export const reorderFormFieldsSchema = z.strictObject({ items: z.array(z.strictObject({ id: z.uuid(), position: z.number().int().nonnegative() })).max(20) })
  .superRefine(({ items }, ctx) => {
    if (new Set(items.map(item => item.id)).size !== items.length) ctx.addIssue({ code: 'custom', message: 'Field IDs must be unique' });
    if (items.map(item => item.position).sort((a, b) => a - b).some((position, index) => position !== index)) ctx.addIssue({ code: 'custom', message: 'Positions must be contiguous' });
  });
const submissionValueSchema = z.union([z.string().max(5000), z.boolean()]);
export const publicSubmissionSchema = z.strictObject({
  values: z.record(z.string().max(40), submissionValueSchema).refine(value => Object.keys(value).length <= 20, 'Too many values'),
  marketingOptIn: z.boolean().default(false), honeypot: z.string().max(200).optional(),
  attribution: z.strictObject({ utmSource: z.string().trim().max(100).optional(), utmMedium: z.string().trim().max(100).optional(), utmCampaign: z.string().trim().max(100).optional() }).optional(),
}).superRefine(({ values }, ctx) => {
  const size = Object.values(values).reduce((total, value) => total + (typeof value === 'string' ? value.length : 1), 0);
  if (size > 20_000) ctx.addIssue({ code: 'custom', path: ['values'], message: 'Submission is too large' });
});
export const contactStatusSchema = z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST']);
export const audienceQuerySchema = z.strictObject({
  status: contactStatusSchema.optional(), tag: z.string().trim().min(1).max(40).optional(), search: z.string().trim().max(100).optional(), source: z.string().trim().max(80).optional(),
  from: z.coerce.date().optional(), to: z.coerce.date().optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const updateContactSchema = z.strictObject({ status: contactStatusSchema.optional(), name: z.string().trim().min(1).max(120).nullable().optional(),
  email: emailSchema.nullable().optional(), phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/).nullable().optional(), marketingOptIn: z.boolean().optional() })
  .refine(value => Object.keys(value).length > 0, 'Provide a contact field');
export const contactNoteSchema = z.strictObject({ note: z.string().trim().min(1).max(2000) });
export const contactTagSchema = z.strictObject({ name: z.string().trim().min(1).max(40) });

export type CreateFormInput = z.input<typeof createFormSchema>;
export type UpdateFormInput = z.input<typeof updateFormSchema>;
export type CreateFormFieldInput = z.input<typeof createFormFieldSchema>;
export type UpdateFormFieldInput = z.input<typeof updateFormFieldSchema>;
export type ReorderFormFieldsInput = z.input<typeof reorderFormFieldsSchema>;
export type PublicSubmissionInput = z.input<typeof publicSubmissionSchema>;
export type AudienceQueryInput = z.output<typeof audienceQuerySchema>;
export type UpdateContactInput = z.input<typeof updateContactSchema>;
