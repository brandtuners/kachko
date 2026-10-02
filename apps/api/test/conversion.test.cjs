const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyticsEventSchema, audienceQuerySchema, createBlockSchema, createFormFieldSchema, createFormSchema, publicSubmissionSchema, updateContactSchema } = require('@kachko/validation');

const pageId = '20da19cc-7e63-4aa9-8cc0-7d68c26acbd2';
const blockId = '3e0df075-67e2-46f6-a4e8-cafefd7a47c8';
const formId = '90fb9297-da0c-45bb-9ece-c73500de00ad';

test('V1.1 block and analytics contracts are strict', () => {
  assert.equal(createBlockSchema.safeParse({ type: 'WHATSAPP', content: { label: 'Chat', phoneNumber: '+919999999999', messageTemplate: 'Interested in {{service}}' } }).success, true);
  assert.equal(createBlockSchema.safeParse({ type: 'WHATSAPP', content: { label: 'Chat', phoneNumber: '99999', messageTemplate: '{{unsafe}}' } }).success, false);
  assert.equal(createBlockSchema.safeParse({ type: 'FORM', content: { formId, variant: 'CARD' } }).success, true);
  assert.equal(createBlockSchema.safeParse({ type: 'SUBSCRIBE', content: { formId, injected: true } }).success, false);
  for (const eventType of ['FORM_VIEW', 'FORM_SUBMIT', 'WHATSAPP_CLICK', 'SUBSCRIBE']) {
    assert.equal(analyticsEventSchema.safeParse({ pageId, blockId, eventType }).success, true, eventType);
    assert.equal(analyticsEventSchema.safeParse({ pageId, eventType }).success, false, eventType);
  }
  assert.equal(analyticsEventSchema.safeParse({ pageId, blockId, eventType: 'LEAD_CREATED' }).success, false);
});

test('form submissions, dynamic fields and audience updates reject unsafe shapes', () => {
  assert.equal(createFormFieldSchema.safeParse({ type: 'SELECT', label: 'Budget', name: 'budget', config: { options: ['Small', 'Large'] } }).success, true);
  assert.equal(createFormFieldSchema.safeParse({ type: 'SELECT', label: 'Budget', name: 'budget' }).success, false);
  assert.equal(createFormSchema.safeParse({ name: 'Redirect', successType: 'REDIRECT', successConfig: { url: 'https://example.com/thanks' } }).success, true);
  assert.equal(createFormSchema.safeParse({ name: 'Broken redirect', successType: 'REDIRECT' }).success, false);
  assert.equal(publicSubmissionSchema.safeParse({ values: { email: 'person@example.com', message: 'Hello' }, marketingOptIn: true }).success, true);
  assert.equal(publicSubmissionSchema.safeParse({ values: Object.fromEntries(Array.from({ length: 5 }, (_, index) => [`field_${index}`, 'x'.repeat(4_500)])) }).success, false);
  assert.equal(publicSubmissionSchema.safeParse({ values: { email: 'person@example.com' }, ownerUserId: pageId }).success, false);
  assert.equal(updateContactSchema.safeParse({ status: 'WON' }).success, true);
  assert.equal(updateContactSchema.safeParse({ ownerUserId: pageId }).success, false);
  assert.equal(audienceQuerySchema.safeParse({ tag: 'Warm lead', page: '1', limit: '25' }).success, true);
});
