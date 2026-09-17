import { z } from 'zod';

export const themeKeySchema = z.enum(['minimal', 'dark', 'gradient', 'professional', 'elegant', 'nature', 'aurora', 'neon-pop', 'cyan-pulse', 'sunset-lime', 'coral-drift']);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color');
const translucentColor = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'Use a hex color');
const backgroundImageOptions = {
  imageMediaId: z.uuid().optional(),
  imageOpacity: z.number().min(0.1).max(0.8).optional(),
  imageFit: z.enum(['cover', 'contain']).optional(),
  imagePositionX: z.number().int().min(0).max(100).optional(),
  imagePositionY: z.number().int().min(0).max(100).optional(),
};
const background = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('solid'), color, ...backgroundImageOptions }),
  z.strictObject({ type: z.literal('gradient'), from: color, to: color, via: color.optional(), glow: translucentColor.optional(), angle: z.number().int().min(0).max(360), ...backgroundImageOptions }),
]);
const typography = z.strictObject({ fontFamily: z.enum(['system', 'manrope', 'dmSans', 'inter', 'lato', 'poppins', 'spaceGrotesk', 'sans', 'verdana', 'trebuchet', 'serif', 'lora', 'playfair', 'times', 'palatino', 'mono', 'spaceMono', 'courier']), titleSize: z.number().int().min(20).max(48), color, titleColor: color.optional() });
const buttons = z.strictObject({ variant: z.enum(['filled', 'outline', 'glass']), radius: z.number().int().min(0).max(32), background: color, color, shadow: z.boolean() });
const cards = z.strictObject({ radius: z.number().int().min(0).max(32), background: translucentColor, border: translucentColor.optional(), blur: z.number().int().min(0).max(24) });
const footer = z.strictObject({ visible: z.boolean() });
export const themeConfigSchema = z.strictObject({ background, typography, buttons, cards, footer: footer.default({ visible: true }) });
export const appearanceOverridesSchema = z.strictObject({
  background: background.optional(), typography: typography.partial().optional(),
  buttons: buttons.partial().optional(), cards: cards.partial().optional(), footer: footer.partial().optional(),
});
export const updateAppearanceSchema = z.strictObject({ themeKey: themeKeySchema.optional(), overrides: appearanceOverridesSchema.optional() })
  .refine(value => Object.keys(value).length > 0, 'Provide themeKey or overrides');
export const templateKeySchema = z.enum(['starter', 'creator', 'professional']);
export const applyTemplateSchema = z.strictObject({ templateKey: templateKeySchema, replaceExistingBlocks: z.boolean().default(false) });
export type ThemeConfig = z.output<typeof themeConfigSchema>;
export type AppearanceOverrides = z.output<typeof appearanceOverridesSchema>;
export type UpdateAppearanceInput = z.input<typeof updateAppearanceSchema>;
export type ApplyTemplateInput = z.input<typeof applyTemplateSchema>;

export function resolveAppearance(base: unknown, overrides: unknown): ThemeConfig {
  const theme = themeConfigSchema.parse(base);
  const patch = appearanceOverridesSchema.parse(overrides);
  return themeConfigSchema.parse({
    background: patch.background ?? theme.background,
    typography: { ...theme.typography, ...patch.typography },
    buttons: { ...theme.buttons, ...patch.buttons }, cards: { ...theme.cards, ...patch.cards },
    footer: { ...theme.footer, ...patch.footer },
  });
}
