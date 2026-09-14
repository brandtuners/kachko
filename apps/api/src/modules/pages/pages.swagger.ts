import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { z, createPageSchema, updatePageSchema, createLinkBlockSchema, updateLinkBlockSchema, publicPageSchema } from '@kachko/validation';

const object = (properties: Record<string, SchemaObject>): SchemaObject => ({ type: 'object', required: Object.keys(properties), properties });
const text: SchemaObject = { type: 'string' };
const nullableText: SchemaObject = { type: 'string', nullable: true };
const date: SchemaObject = { type: 'string', format: 'date-time' };
const content = object({ title: text, url: { type: 'string', format: 'uri' }, openInNewTab: { type: 'boolean' } });
export const linkBlock = object({ id: { type: 'string', format: 'uuid' }, type: { type: 'string', enum: ['LINK'] },
  position: { type: 'integer', minimum: 0 }, isVisible: { type: 'boolean' }, content, createdAt: date, updatedAt: date });
const pageProperties = { id: { type: 'string', format: 'uuid' }, slug: text, title: nullableText, description: nullableText,
  themeKey: { type: 'string', enum: ['minimal'] }, isPublished: { type: 'boolean' }, publishedAt: { ...date, nullable: true }, createdAt: date, updatedAt: date } satisfies Record<string, SchemaObject>;
export const envelope = (data: SchemaObject) => object({ data });
export const pageResponse = envelope(object({ ...pageProperties, blocks: { type: 'array', items: linkBlock } }));
export const pagesResponse = envelope({ type: 'array', items: object(pageProperties) });
export const deletedResponse = envelope(object({ deleted: { type: 'boolean', enum: [true] } }));
const input = (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input' }) as SchemaObject;
export const pageCreateBody = input(createPageSchema);
export const pageUpdateBody = input(updatePageSchema);
export const linkCreateBody = input(createLinkBlockSchema);
export const linkUpdateBody = input(updateLinkBlockSchema);
export const publicResponse = envelope(input(publicPageSchema));
