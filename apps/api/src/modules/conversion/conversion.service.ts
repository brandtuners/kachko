import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createFormFieldSchema, createFormSchema, emailSchema, type AudienceQueryInput, type CreateFormFieldInput, type CreateFormInput, type PublicSubmissionInput, type ReorderFormFieldsInput, type UpdateContactInput, type UpdateFormFieldInput, type UpdateFormInput } from '@kachko/validation';
import type { CreatorForm } from '@kachko/types';
import type { Form, FormField, Prisma } from '../../generated/prisma/client';
import { identityError } from '../identity/identity.service';
import { ConversionRepository } from './conversion.repository';

type StoredForm = Form & { fields: FormField[] };
const clean = (value: string) => Array.from(value.replace(/<[^>]*>/g, '')).map(character => {
  const code = character.charCodeAt(0); return code < 32 || code === 127 ? ' ' : character;
}).join('').trim();
const looksLikeSpam = (values: Record<string, string | boolean>) => {
  const text = Object.values(values).filter((value): value is string => typeof value === 'string').join(' ');
  const links = text.match(/https?:\/\//gi)?.length ?? 0;
  return links >= 4 || (links >= 2 && /\b(?:casino|viagra|crypto giveaway|seo backlinks?)\b/i.test(text));
};
type ContactWithTags = Prisma.ContactGetPayload<{ include: { tags: { include: { tag: true } } } }>;
const formDto = (form: StoredForm): CreatorForm => ({ id: form.id, pageId: form.pageId, name: form.name, title: form.title,
  description: form.description, submitLabel: form.submitLabel, successType: form.successType,
  successConfig: form.successConfig as CreatorForm['successConfig'], isActive: form.isActive,
  fields: form.fields.map(field => ({ id: field.id, type: field.type, label: field.label, name: field.name,
    placeholder: field.placeholder, required: field.required, position: field.position, config: field.config as { options?: string[] } | null })),
  createdAt: form.createdAt.toISOString(), updatedAt: form.updatedAt.toISOString() });

@Injectable()
export class ConversionService {
  constructor(private readonly repository: ConversionRepository, private readonly config: ConfigService) {}
  private missing(): never { return identityError(404, 'FORM_NOT_FOUND', 'Form not found'); }
  async listForms(userId: string, pageId: string) { if (!await this.repository.ownedPage(userId, pageId)) this.missing(); return { data: (await this.repository.listForms(userId, pageId)).map(formDto) }; }
  async form(userId: string, id: string) { const form = await this.repository.form(userId, id); if (!form) this.missing(); return { data: formDto(form) }; }
  async createForm(userId: string, pageId: string, input: CreateFormInput) { if (!await this.repository.ownedPage(userId, pageId)) this.missing(); return { data: formDto(await this.repository.createForm(userId, pageId, input)) }; }
  async updateForm(userId: string, id: string, input: UpdateFormInput) {
    const current = await this.repository.form(userId, id); if (!current) this.missing();
    const merged = createFormSchema.safeParse({ name: input.name ?? current.name, title: input.title === undefined ? current.title : input.title,
      description: input.description === undefined ? current.description : input.description, submitLabel: input.submitLabel ?? current.submitLabel,
      successType: input.successType ?? current.successType, successConfig: input.successConfig === undefined ? current.successConfig : input.successConfig,
      isActive: input.isActive ?? current.isActive });
    if (!merged.success) identityError(400, 'FORM_INVALID', merged.error.issues[0]?.message ?? 'Form is invalid');
    const form = await this.repository.updateForm(userId, id, input); if (!form) this.missing(); return { data: formDto(form) };
  }
  async deleteForm(userId: string, id: string) { const result = await this.repository.deleteForm(userId, id); if (result === 'missing') this.missing(); if (result === 'in-use') identityError(409, 'FORM_IN_USE', 'Remove form blocks before deleting this form'); return { data: { deleted: true as const } }; }
  async addField(userId: string, id: string, input: CreateFormFieldInput) { const form = await this.repository.addField(userId, id, input); if (!form) this.missing(); if (form === 'limit') identityError(409, 'FORM_FIELD_LIMIT', 'Forms support up to 20 fields'); if (form === 'conflict') identityError(409, 'FORM_FIELD_NAME_CONFLICT', 'Field names must be unique within a form'); return { data: formDto(form) }; }
  async updateField(userId: string, id: string, fieldId: string, input: UpdateFormFieldInput) {
    const current = await this.repository.form(userId, id); if (!current) this.missing();
    const field = current.fields.find(item => item.id === fieldId); if (!field) this.missing();
    const merged = createFormFieldSchema.safeParse({ type: input.type ?? field.type, label: input.label ?? field.label, name: input.name ?? field.name,
      placeholder: input.placeholder === undefined ? field.placeholder : input.placeholder, required: input.required ?? field.required,
      config: input.config === undefined ? field.config : input.config });
    if (!merged.success) identityError(400, 'FORM_FIELD_INVALID', merged.error.issues[0]?.message ?? 'Field is invalid');
    const form = await this.repository.updateField(userId, id, fieldId, input); if (!form) this.missing();
    if (form === 'conflict') identityError(409, 'FORM_FIELD_NAME_CONFLICT', 'Field names must be unique within a form'); return { data: formDto(form) };
  }
  async deleteField(userId: string, id: string, fieldId: string) { const form = await this.repository.deleteField(userId, id, fieldId); if (!form) this.missing(); return { data: formDto(form) }; }
  async reorderFields(userId: string, id: string, input: ReorderFormFieldsInput) { const form = await this.repository.reorderFields(userId, id, input); if (!form) this.missing(); if (form === 'conflict') identityError(409, 'FIELD_ORDER_CONFLICT', 'Reload fields and try again'); return { data: formDto(form) }; }

  async submit(id: string, input: PublicSubmissionInput, request: Request) {
    const form = await this.repository.publicForm(id);
    if (!form || !form.page.blocks.some(block => (block.content as { formId?: string }).formId === id)) this.missing();
    if (input.honeypot) return { data: { submitted: true as const, contactId: '00000000-0000-0000-0000-000000000000' } };
    const known = new Set(form.fields.map(field => field.name));
    if (Object.keys(input.values).some(name => !known.has(name))) identityError(400, 'FORM_VALUES_INVALID', 'Unknown form field');
    const values: Record<string, string | boolean> = {};
    for (const field of form.fields) {
      const raw = input.values[field.name];
      if ((raw === undefined || raw === '' || raw === false) && field.required) identityError(400, 'FORM_VALUES_INVALID', `${field.label} is required`);
      if (raw === undefined) continue;
      if (field.type === 'CHECKBOX') { if (typeof raw !== 'boolean') identityError(400, 'FORM_VALUES_INVALID', `${field.label} must be checked or unchecked`); values[field.name] = raw; continue; }
      if (typeof raw !== 'string') identityError(400, 'FORM_VALUES_INVALID', `${field.label} is invalid`);
      const value = clean(raw);
      if (field.type === 'EMAIL') {
        const email = emailSchema.safeParse(value);
        if (!email.success) identityError(400, 'FORM_VALUES_INVALID', `${field.label} must be an email`);
        values[field.name] = email.data;
        continue;
      }
      if (field.type === 'PHONE' && !/^\+[1-9]\d{6,14}$/.test(value)) identityError(400, 'FORM_VALUES_INVALID', `${field.label} must use an international number`);
      if (field.type === 'SELECT' && !(field.config as { options?: string[] } | null)?.options?.includes(value)) identityError(400, 'FORM_VALUES_INVALID', `${field.label} has an invalid option`);
      values[field.name] = value;
    }
    if (looksLikeSpam(values)) identityError(400, 'FORM_SPAM_REJECTED', 'Submission could not be accepted');
    const value = (names: string[]) => names.map(name => values[name]).find(item => typeof item === 'string') as string | undefined;
    const email = value(['email', 'email_address']);
    const phone = value(['phone', 'phone_number']);
    if (!email && !phone) identityError(400, 'FORM_VALUES_INVALID', 'A valid email or phone field is required');
    const address = request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ?? request.ip;
    const ipHash = address ? createHmac('sha256', this.config.getOrThrow<string>('ANALYTICS_HASH_SALT')).update(address).digest('hex') : null;
    const source = form.page.blocks.find(block => (block.content as { formId?: string }).formId === id)?.type === 'SUBSCRIBE' ? 'SUBSCRIBE' : 'FORM';
    const result = await this.repository.submit(id, form.page.user.id, form.pageId, values, input, { name: value(['name', 'full_name']), email, phone }, ipHash, source);
    const config = form.successConfig as { message?: string; url?: string } | null;
    return { data: { submitted: true as const, contactId: result.contact.id, ...(form.successType === 'REDIRECT' && config?.url ? { redirectUrl: config.url } : { message: config?.message ?? 'Thanks — your response was received.' }) } };
  }

  private contactDto(contact: ContactWithTags) { return { id: contact.id, name: contact.name, email: contact.email, phone: contact.phone, status: contact.status,
    source: contact.source, marketingOptIn: contact.marketingOptIn, lastActivityAt: contact.lastActivityAt?.toISOString() ?? null,
    createdAt: contact.createdAt.toISOString(), updatedAt: contact.updatedAt.toISOString(), tags: contact.tags.map(item => ({ id: item.tag.id, name: item.tag.name })) }; }
  async contacts(userId: string, query: AudienceQueryInput) { const [items, total] = await this.repository.contacts(userId, query); return { data: { items: items.map(item => this.contactDto(item)), page: query.page, limit: query.limit, total } }; }
  async contact(userId: string, id: string) { const contact = await this.repository.contact(userId, id); if (!contact) identityError(404, 'CONTACT_NOT_FOUND', 'Contact not found'); return { data: { ...this.contactDto(contact),
    submissions: contact.submissions.map(item => ({ id: item.id, formName: item.form.name, payload: item.payload, createdAt: item.createdAt.toISOString() })),
    notes: contact.notes.map(item => ({ id: item.id, note: item.note, createdAt: item.createdAt.toISOString() })) } }; }
  async updateContact(userId: string, id: string, input: UpdateContactInput) { const contact = await this.repository.updateContact(userId, id, input); if (!contact) identityError(404, 'CONTACT_NOT_FOUND', 'Contact not found'); return this.contact(userId, id); }
  async addNote(userId: string, id: string, note: string) { const contact = await this.repository.addNote(userId, id, note); if (!contact) identityError(404, 'CONTACT_NOT_FOUND', 'Contact not found'); return this.contact(userId, id); }
  async addTag(userId: string, id: string, name: string) { const contact = await this.repository.addTag(userId, id, name); if (!contact) identityError(404, 'CONTACT_NOT_FOUND', 'Contact not found'); return this.contact(userId, id); }
  async removeTag(userId: string, id: string, tagId: string) { const contact = await this.repository.removeTag(userId, id, tagId); if (!contact) identityError(404, 'CONTACT_NOT_FOUND', 'Contact or tag not found'); return this.contact(userId, id); }
  async csv(userId: string) { const rows = await this.repository.exportContacts(userId); const safe = (value: unknown) => { const text = String(value ?? ''); const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${guarded.replaceAll('"', '""')}"`; };
    return ['name,email,phone,status,source,marketing_opt_in,tags,created_at', ...rows.map(row => [row.name, row.email, row.phone, row.status, row.source, row.marketingOptIn, row.tags.map(tag => tag.tag.name).join('|'), row.createdAt.toISOString()].map(safe).join(','))].join('\r\n'); }
}
