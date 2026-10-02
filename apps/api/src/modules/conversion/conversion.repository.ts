import { Injectable } from '@nestjs/common';
import { Prisma, type ContactStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { AudienceQueryInput, CreateFormFieldInput, CreateFormInput, PublicSubmissionInput, ReorderFormFieldsInput, UpdateContactInput, UpdateFormFieldInput, UpdateFormInput } from '@kachko/validation';

const orderedFields = { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] };
const fullForm = { fields: orderedFields };

@Injectable()
export class ConversionRepository {
  constructor(private readonly db: PrismaService) {}

  ownedPage(userId: string, pageId: string) { return this.db.page.findFirst({ where: { id: pageId, userId }, select: { id: true } }); }
  listForms(userId: string, pageId: string) { return this.db.form.findMany({ where: { pageId, page: { userId } }, include: fullForm, orderBy: { createdAt: 'asc' } }); }
  form(userId: string, formId: string) { return this.db.form.findFirst({ where: { id: formId, page: { userId } }, include: fullForm }); }
  createForm(userId: string, pageId: string, input: CreateFormInput) {
    return this.db.form.create({ data: { ...input, successConfig: input.successConfig ?? Prisma.JsonNull, page: { connect: { id: pageId, userId } } }, include: fullForm });
  }
  updateForm(userId: string, formId: string, input: UpdateFormInput) {
    return this.db.$transaction(async tx => {
      const form = await tx.form.findFirst({ where: { id: formId, page: { userId } }, select: { id: true } });
      if (!form) return null;
      const { successConfig, ...data } = input;
      return tx.form.update({ where: { id: formId }, data: { ...data,
        ...(successConfig !== undefined ? { successConfig: successConfig === null ? Prisma.JsonNull : successConfig as Prisma.InputJsonObject } : {}) }, include: fullForm });
    });
  }
  deleteForm(userId: string, formId: string) {
    return this.db.$transaction(async tx => {
      const form = await tx.form.findFirst({ where: { id: formId, page: { userId } }, include: { page: { include: { blocks: { where: { type: { in: ['FORM', 'SUBSCRIBE'] } }, select: { content: true } } } } } });
      if (!form) return 'missing' as const;
      if (form.page.blocks.some(block => (block.content as { formId?: string }).formId === formId)) return 'in-use' as const;
      await tx.form.delete({ where: { id: formId } });
      return 'deleted' as const;
    });
  }
  addField(userId: string, formId: string, input: CreateFormFieldInput) {
    return this.db.$transaction(async tx => {
      const form = await tx.form.findFirst({ where: { id: formId, page: { userId } }, include: { fields: { select: { name: true } } } });
      if (!form) return null;
      if (form.fields.length >= 20) return 'limit' as const;
      if (form.fields.some(field => field.name === input.name)) return 'conflict' as const;
      const position = form.fields.length;
      await tx.formField.create({ data: { ...input, config: input.config ?? Prisma.JsonNull, formId, position } });
      return tx.form.findUniqueOrThrow({ where: { id: formId }, include: fullForm });
    });
  }
  updateField(userId: string, formId: string, fieldId: string, input: UpdateFormFieldInput) {
    return this.db.$transaction(async tx => {
      const field = await tx.formField.findFirst({ where: { id: fieldId, formId, form: { page: { userId } } }, select: { id: true } });
      if (!field) return null;
      if (input.name && await tx.formField.findFirst({ where: { formId, name: input.name, id: { not: fieldId } }, select: { id: true } })) return 'conflict' as const;
      const { config, ...data } = input;
      await tx.formField.update({ where: { id: fieldId }, data: { ...data,
        ...(config !== undefined ? { config: config === null ? Prisma.JsonNull : config as Prisma.InputJsonObject } : {}) } });
      return tx.form.findUniqueOrThrow({ where: { id: formId }, include: fullForm });
    });
  }
  deleteField(userId: string, formId: string, fieldId: string) {
    return this.db.$transaction(async tx => {
      const field = await tx.formField.findFirst({ where: { id: fieldId, formId, form: { page: { userId } } } });
      if (!field) return null;
      await tx.formField.delete({ where: { id: fieldId } });
      await tx.formField.updateMany({ where: { formId, position: { gt: field.position } }, data: { position: { decrement: 1 } } });
      return tx.form.findUniqueOrThrow({ where: { id: formId }, include: fullForm });
    });
  }
  reorderFields(userId: string, formId: string, input: ReorderFormFieldsInput) {
    return this.db.$transaction(async tx => {
      const form = await tx.form.findFirst({ where: { id: formId, page: { userId } }, include: { fields: true } });
      if (!form) return null;
      const ids = new Set(form.fields.map(field => field.id));
      if (ids.size !== input.items.length || input.items.some(item => !ids.has(item.id))) return 'conflict' as const;
      for (const item of input.items) await tx.formField.update({ where: { id: item.id }, data: { position: item.position } });
      return tx.form.findUniqueOrThrow({ where: { id: formId }, include: fullForm });
    });
  }

  publicForm(formId: string) {
    return this.db.form.findFirst({ where: { id: formId, isActive: true, page: { isPublished: true, user: { isActive: true, deletedAt: null } } },
      include: { fields: orderedFields, page: { include: { blocks: { where: { isVisible: true, type: { in: ['FORM', 'SUBSCRIBE'] } }, select: { id: true, type: true, content: true } }, user: { select: { id: true } } } } } });
  }
  submit(formId: string, ownerUserId: string, pageId: string, values: Record<string, string | boolean>, input: PublicSubmissionInput,
    identity: { name?: string; email?: string; phone?: string }, ipHash: string | null, source: string) {
    return this.db.$transaction(async tx => {
      const match = [identity.email ? { email: identity.email } : undefined, identity.phone ? { phone: identity.phone } : undefined].filter(Boolean) as Prisma.ContactWhereInput[];
      const existing = match.length ? await tx.contact.findFirst({ where: { ownerUserId, OR: match }, orderBy: { createdAt: 'asc' } }) : null;
      const contact = existing ? await tx.contact.update({ where: { id: existing.id }, data: {
        name: identity.name ?? existing.name, email: identity.email ?? existing.email, phone: identity.phone ?? existing.phone,
        marketingOptIn: existing.marketingOptIn || input.marketingOptIn, lastActivityAt: new Date(), source,
        sourceDetails: input.attribution as Prisma.InputJsonObject | undefined,
      } }) : await tx.contact.create({ data: { ownerUserId, ...identity, marketingOptIn: input.marketingOptIn,
        lastActivityAt: new Date(), source, sourceDetails: input.attribution as Prisma.InputJsonObject | undefined } });
      const submission = await tx.formSubmission.create({ data: { formId, contactId: contact.id, payload: values as Prisma.InputJsonObject,
        attribution: input.attribution as Prisma.InputJsonObject | undefined, ipHash } });
      await tx.analyticsEvent.createMany({ data: [
        { pageId, eventType: source === 'SUBSCRIBE' ? 'SUBSCRIBE' : 'FORM_SUBMIT', ipHash },
        ...(!existing ? [{ pageId, eventType: 'LEAD_CREATED' as const, ipHash }] : []),
      ] });
      return { contact, submission, created: !existing };
    });
  }

  contacts(userId: string, query: AudienceQueryInput) {
    const where: Prisma.ContactWhereInput = { ownerUserId: userId,
      ...(query.status ? { status: query.status as ContactStatus } : {}), ...(query.source ? { source: query.source } : {}),
      ...(query.tag ? { tags: { some: { tag: { ownerUserId: userId, name: { equals: query.tag, mode: 'insensitive' } } } } } : {}),
      ...(query.search ? { OR: ['name', 'email', 'phone'].map(field => ({ [field]: { contains: query.search, mode: 'insensitive' as const } })) } : {}),
      ...((query.from || query.to) ? { createdAt: { gte: query.from, lte: query.to } } : {}),
    };
    return Promise.all([
      this.db.contact.findMany({ where, include: { tags: { include: { tag: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
      this.db.contact.count({ where }),
    ]);
  }
  contact(userId: string, id: string) { return this.db.contact.findFirst({ where: { id, ownerUserId: userId }, include: {
    tags: { include: { tag: true } }, notes: { orderBy: { createdAt: 'desc' } },
    submissions: { orderBy: { createdAt: 'desc' }, include: { form: { select: { name: true } } } },
  } }); }
  async updateContact(userId: string, id: string, input: UpdateContactInput) {
    if (!await this.db.contact.findFirst({ where: { id, ownerUserId: userId }, select: { id: true } })) return null;
    await this.db.contact.update({ where: { id }, data: input });
    return this.contact(userId, id);
  }
  async addNote(userId: string, id: string, note: string) {
    if (!await this.db.contact.findFirst({ where: { id, ownerUserId: userId }, select: { id: true } })) return null;
    await this.db.contactNote.create({ data: { contactId: id, authorId: userId, note } });
    return this.contact(userId, id);
  }
  async addTag(userId: string, id: string, name: string) {
    if (!await this.db.contact.findFirst({ where: { id, ownerUserId: userId }, select: { id: true } })) return null;
    const tag = await this.db.tag.upsert({ where: { ownerUserId_name: { ownerUserId: userId, name } }, create: { ownerUserId: userId, name }, update: {} });
    await this.db.contactTag.upsert({ where: { contactId_tagId: { contactId: id, tagId: tag.id } }, create: { contactId: id, tagId: tag.id }, update: {} });
    return this.contact(userId, id);
  }
  async removeTag(userId: string, id: string, tagId: string) {
    if (!await this.db.contact.findFirst({ where: { id, ownerUserId: userId, tags: { some: { tagId, tag: { ownerUserId: userId } } } }, select: { id: true } })) return null;
    await this.db.contactTag.delete({ where: { contactId_tagId: { contactId: id, tagId } } });
    return this.contact(userId, id);
  }
  exportContacts(userId: string) { return this.db.contact.findMany({ where: { ownerUserId: userId }, include: { tags: { include: { tag: true } } }, orderBy: { createdAt: 'desc' } }); }
}
