import { z } from 'zod';

// Version-controlled seed data: no fake User records are created for reserved names.
export const RESERVED_USERNAMES = [
  'admin', 'administrator', 'api', 'login', 'signup', 'dashboard', 'settings',
  'support', 'help', 'privacy', 'terms', 'about', 'auth', 'register', 'logout',
  'public', 'health', 'users', 'assets', 'static', 'www', 'kachko',
] as const;
export const usernameSchema = z.string().trim().toLowerCase().min(3).max(30)
  .regex(/^[a-z0-9_.-]+$/, 'Use letters, digits, underscores, dots or hyphens');
export const availableUsernameSchema = usernameSchema.refine(
  value => !(RESERVED_USERNAMES as readonly string[]).includes(value), 'Username is reserved');
export const emailSchema = z.string().trim().toLowerCase().max(254).email();
export const passwordSchema = z.string().min(12).max(128);
export const registerSchema = z.strictObject({
  email: emailSchema, password: passwordSchema, username: availableUsernameSchema,
  displayName: z.string().trim().min(1).max(80).optional(),
});
export const loginSchema = z.strictObject({ email: emailSchema, password: z.string().min(1).max(128) });
export const profileSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(80).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  username: availableUsernameSchema.optional(),
}).refine(value => Object.keys(value).length > 0, 'Provide at least one profile field');
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export { z };

export const googleRegistrationSchema = z.strictObject({
  username: availableUsernameSchema,
  displayName: z.string().trim().min(1).max(80).optional(),
});
export type GoogleRegistrationInput = z.infer<typeof googleRegistrationSchema>;

export * from './pages';

export * from './appearance';
export * from './socials';
export * from './media';
