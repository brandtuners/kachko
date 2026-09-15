import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { z, publicBlockSchema, themeConfigSchema, appearanceOverridesSchema, themeKeySchema, updateAppearanceSchema, applyTemplateSchema, createSocialSchema, updateSocialSchema, socialPlatformSchema, createPageSchema, updatePageSchema, createBlockSchema, updateBlockSchema, reorderBlocksSchema, publicPageSchema } from '@kachko/validation';

const object = (properties: Record<string, SchemaObject>): SchemaObject => ({ type: 'object', required: Object.keys(properties), properties });
const text: SchemaObject = { type: 'string' };
const nullableText: SchemaObject = { type: 'string', nullable: true };
const date: SchemaObject = { type: 'string', format: 'date-time' };
const content = object({ title: text, url: { type: 'string', format: 'uri' }, openInNewTab: { type: 'boolean' } });
export const linkBlock = object({ id: { type: 'string', format: 'uuid' }, type: { type: 'string', enum: ['LINK'] },
  position: { type: 'integer', minimum: 0 }, isVisible: { type: 'boolean' }, content, createdAt: date, updatedAt: date });
export const block: SchemaObject = input(publicBlockSchema);
for (const variant of block.oneOf ?? block.anyOf ?? []) {
  if ('properties' in variant) {
    variant.properties = { ...variant.properties, position: { type: 'integer', minimum: 0 }, isVisible: { type: 'boolean' }, createdAt: date, updatedAt: date };
    variant.required = [...(variant.required ?? []), 'position', 'isVisible', 'createdAt', 'updatedAt'];
  }
}
const pageProperties = { id: { type: 'string', format: 'uuid' }, slug: text, title: nullableText, description: nullableText,
  themeKey: { type: 'string', enum: [...themeKeySchema.options] }, isPublished: { type: 'boolean' }, publishedAt: { ...date, nullable: true }, createdAt: date, updatedAt: date } satisfies Record<string, SchemaObject>;
export const envelope = (data: SchemaObject) => object({ data });
export const social = object({ id: { type: 'string', format: 'uuid' }, platform: { type: 'string', enum: [...socialPlatformSchema.options] }, username: nullableText, url: { type: 'string', format: 'uri' },
  position: { type: 'integer', minimum: 0 }, isVisible: { type: 'boolean' }, createdAt: date, updatedAt: date });
export const socialsResponse = envelope({ type: 'array', items: social });
export const pageResponse = envelope(object({ ...pageProperties, blocks: { type: 'array', items: block }, appearance: input(themeConfigSchema), appearanceOverrides: input(appearanceOverridesSchema), socials: { type: 'array', items: social } }));
export const pagesResponse = envelope({ type: 'array', items: object(pageProperties) });
export const deletedResponse = envelope(object({ deleted: { type: 'boolean', enum: [true] } }));
function input(schema: z.ZodType) { return z.toJSONSchema(schema, { io: 'input' }) as SchemaObject; }
export const pageCreateBody = input(createPageSchema);
export const pageUpdateBody = input(updatePageSchema);
export const blockCreateBody = input(createBlockSchema);
export const blockUpdateBody = input(updateBlockSchema);
export const reorderBody = input(reorderBlocksSchema);
export const publicResponse = envelope(input(publicPageSchema));

export const appearanceBody = input(updateAppearanceSchema);
export const templateBody = input(applyTemplateSchema);
export const socialCreateBody = input(createSocialSchema);
export const socialUpdateBody = input(updateSocialSchema);
export const appearanceResponse = envelope(object({ themeKey: { type: 'string', enum: [...themeKeySchema.options] }, appearance: input(themeConfigSchema), overrides: input(appearanceOverridesSchema) }));
export const theme = object({ id: { type: 'string', format: 'uuid' }, key: { type: 'string', enum: [...themeKeySchema.options] }, name: text, config: input(themeConfigSchema) });
export const themesResponse = envelope({ type: 'array', items: theme });
export const template = object({ key: text, name: text, description: text, themeKey: { type: 'string', enum: [...themeKeySchema.options] }, blocks: { type: 'array', items: input(createBlockSchema) } });
export const templatesResponse = envelope({ type: 'array', items: template });
