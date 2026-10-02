ALTER TYPE "BlockType" ADD VALUE 'WHATSAPP';
ALTER TYPE "BlockType" ADD VALUE 'FORM';
ALTER TYPE "BlockType" ADD VALUE 'SUBSCRIBE';

ALTER TYPE "AnalyticsEventType" ADD VALUE 'FORM_VIEW';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'FORM_SUBMIT';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'LEAD_CREATED';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'WHATSAPP_CLICK';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'SUBSCRIBE';

CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST');
CREATE TYPE "FormSuccessType" AS ENUM ('MESSAGE', 'REDIRECT');
CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'EMAIL', 'PHONE', 'TEXTAREA', 'SELECT', 'CHECKBOX');

CREATE TABLE "Contact" (
  "id" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "name" TEXT, "email" TEXT, "phone" TEXT,
  "status" "ContactStatus" NOT NULL DEFAULT 'NEW', "source" TEXT, "sourceDetails" JSONB,
  "marketingOptIn" BOOLEAN NOT NULL DEFAULT false, "lastActivityAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Form" (
  "id" TEXT NOT NULL, "pageId" TEXT NOT NULL, "name" TEXT NOT NULL, "title" TEXT, "description" TEXT,
  "submitLabel" TEXT NOT NULL DEFAULT 'Submit', "successType" "FormSuccessType" NOT NULL DEFAULT 'MESSAGE',
  "successConfig" JSONB, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FormField" (
  "id" TEXT NOT NULL, "formId" TEXT NOT NULL, "type" "FormFieldType" NOT NULL, "label" TEXT NOT NULL,
  "name" TEXT NOT NULL, "placeholder" TEXT, "required" BOOLEAN NOT NULL DEFAULT false, "position" INTEGER NOT NULL,
  "config" JSONB, CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FormSubmission" (
  "id" TEXT NOT NULL, "formId" TEXT NOT NULL, "contactId" TEXT, "payload" JSONB NOT NULL,
  "attribution" JSONB, "ipHash" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ContactNote" (
  "id" TEXT NOT NULL, "contactId" TEXT NOT NULL, "authorId" TEXT NOT NULL, "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ContactNote_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Tag" (
  "id" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ContactTag" ("contactId" TEXT NOT NULL, "tagId" TEXT NOT NULL, CONSTRAINT "ContactTag_pkey" PRIMARY KEY ("contactId", "tagId"));

CREATE INDEX "Contact_ownerUserId_createdAt_idx" ON "Contact"("ownerUserId", "createdAt");
CREATE INDEX "Contact_ownerUserId_email_idx" ON "Contact"("ownerUserId", "email");
CREATE INDEX "Contact_ownerUserId_phone_idx" ON "Contact"("ownerUserId", "phone");
CREATE INDEX "Contact_ownerUserId_status_idx" ON "Contact"("ownerUserId", "status");
CREATE INDEX "Form_pageId_idx" ON "Form"("pageId");
CREATE UNIQUE INDEX "FormField_formId_name_key" ON "FormField"("formId", "name");
CREATE INDEX "FormField_formId_position_idx" ON "FormField"("formId", "position");
CREATE INDEX "FormSubmission_formId_createdAt_idx" ON "FormSubmission"("formId", "createdAt");
CREATE INDEX "FormSubmission_contactId_createdAt_idx" ON "FormSubmission"("contactId", "createdAt");
CREATE INDEX "FormSubmission_ipHash_createdAt_idx" ON "FormSubmission"("ipHash", "createdAt");
CREATE INDEX "ContactNote_contactId_createdAt_idx" ON "ContactNote"("contactId", "createdAt");
CREATE UNIQUE INDEX "Tag_ownerUserId_name_key" ON "Tag"("ownerUserId", "name");
CREATE INDEX "ContactTag_tagId_idx" ON "ContactTag"("tagId");

ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Form" ADD CONSTRAINT "Form_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
