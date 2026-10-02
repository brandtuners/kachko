import type { ApiData } from './index';

export type ContactStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'WON' | 'LOST';
export type FormFieldType = 'TEXT' | 'EMAIL' | 'PHONE' | 'TEXTAREA' | 'SELECT' | 'CHECKBOX';
export interface FormField {
  id: string; type: FormFieldType; label: string; name: string; placeholder: string | null;
  required: boolean; position: number; config: { options?: string[] } | null;
}
export interface CreatorForm {
  id: string; pageId: string; name: string; title: string | null; description: string | null;
  submitLabel: string; successType: 'MESSAGE' | 'REDIRECT'; successConfig: { message?: string; url?: string } | null;
  isActive: boolean; fields: FormField[]; createdAt: string; updatedAt: string;
}
export interface Contact {
  id: string; name: string | null; email: string | null; phone: string | null; status: ContactStatus;
  source: string | null; marketingOptIn: boolean; lastActivityAt: string | null; createdAt: string; updatedAt: string;
  tags: { id: string; name: string }[];
}
export interface ContactDetail extends Contact {
  submissions: { id: string; formName: string; payload: Record<string, string | boolean>; createdAt: string }[];
  notes: { id: string; note: string; createdAt: string }[];
}
export type FormsResponse = ApiData<CreatorForm[]>;
export type FormResponse = ApiData<CreatorForm>;
export type ContactsResponse = ApiData<{ items: Contact[]; page: number; limit: number; total: number }>;
export type ContactResponse = ApiData<ContactDetail>;
export type SubmissionResponse = ApiData<{ submitted: true; contactId: string; message?: string; redirectUrl?: string }>;
export interface ConversionFunnel { visitors: number; actions: number; leads: number; conversionRate: number }
export type ConversionFunnelResponse = ApiData<ConversionFunnel>;
