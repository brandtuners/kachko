import type { ContactDetail, ContactsResponse, ContactStatus, CreatorForm } from "@kachko/types";
import { apiFetch } from "../../lib/api";

export type FormInput = { name: string; title?: string | null; description?: string | null; submitLabel?: string; successType?: "MESSAGE" | "REDIRECT"; successConfig?: { message?: string; url?: string } | null; isActive?: boolean };
export type FieldInput = { type: "TEXT" | "EMAIL" | "PHONE" | "TEXTAREA" | "SELECT" | "CHECKBOX"; label: string; name: string; placeholder?: string | null; required?: boolean; config?: { options?: string[] } | null };

export const listForms = (pageId: string) => apiFetch<CreatorForm[]>(`/pages/${pageId}/forms`);
export const getForm = (id: string) => apiFetch<CreatorForm>(`/forms/${id}`);
export const createForm = (pageId: string, input: FormInput) => apiFetch<CreatorForm>(`/pages/${pageId}/forms`, { method: "POST", body: JSON.stringify(input) });
export const updateForm = (id: string, input: Partial<FormInput>) => apiFetch<CreatorForm>(`/forms/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const deleteForm = (id: string) => apiFetch<void>(`/forms/${id}`, { method: "DELETE" });
export const addField = (formId: string, input: FieldInput) => apiFetch<CreatorForm>(`/forms/${formId}/fields`, { method: "POST", body: JSON.stringify(input) });
export const updateField = (formId: string, fieldId: string, input: Partial<FieldInput>) => apiFetch<CreatorForm>(`/forms/${formId}/fields/${fieldId}`, { method: "PATCH", body: JSON.stringify(input) });
export const deleteField = (formId: string, fieldId: string) => apiFetch<CreatorForm>(`/forms/${formId}/fields/${fieldId}`, { method: "DELETE" });
export const reorderFields = (formId: string, ids: string[]) => apiFetch<CreatorForm>(`/forms/${formId}/fields/reorder`, { method: "POST", body: JSON.stringify({ items: ids.map((id, position) => ({ id, position })) }) });

export async function createTemplateForm(pageId: string, kind: "FORM" | "SUBSCRIBE"): Promise<CreatorForm> {
  let form = await createForm(pageId, kind === "SUBSCRIBE"
    ? { name: "Newsletter signup", title: "Join my newsletter", submitLabel: "Subscribe", successConfig: { message: "You're subscribed!" } }
    : { name: "Contact form", title: "Contact me", submitLabel: "Send", successConfig: { message: "Thanks — I'll be in touch." } });
  const fields: FieldInput[] = kind === "SUBSCRIBE"
    ? [{ type: "EMAIL", label: "Email", name: "email", placeholder: "you@example.com", required: true }, { type: "CHECKBOX", label: "I agree to receive updates", name: "marketing_consent", required: true }]
    : [{ type: "TEXT", label: "Name", name: "name", required: true }, { type: "EMAIL", label: "Email", name: "email", required: true }, { type: "TEXTAREA", label: "Message", name: "message", required: true }];
  for (const field of fields) form = await addField(form.id, field);
  return form;
}

export const listContacts = (query = "") => apiFetch<ContactsResponse["data"]>(`/audience/contacts${query ? `?${query}` : ""}`);
export const getContact = (id: string) => apiFetch<ContactDetail>(`/audience/contacts/${id}`);
export const updateContact = (id: string, input: { status?: ContactStatus; name?: string | null; email?: string | null; phone?: string | null; marketingOptIn?: boolean }) => apiFetch<ContactDetail>(`/audience/contacts/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const addContactNote = (id: string, note: string) => apiFetch<ContactDetail>(`/audience/contacts/${id}/notes`, { method: "POST", body: JSON.stringify({ note }) });
export const addContactTag = (id: string, name: string) => apiFetch<ContactDetail>(`/audience/contacts/${id}/tags`, { method: "POST", body: JSON.stringify({ name }) });
export const removeContactTag = (id: string, tagId: string) => apiFetch<ContactDetail>(`/audience/contacts/${id}/tags/${tagId}`, { method: "DELETE" });
