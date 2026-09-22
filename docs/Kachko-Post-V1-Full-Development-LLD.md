# Kachko — Post‑V1 Development LLD

> **Purpose:** Detailed Low-Level Design for the development work that begins **after V1 is deployed to production**.
>
> **Source direction:** This document follows the post‑V1 strategy:
>
> **Identity → Conversion → Smart Growth → Audience Ownership → Payments → Booking → Digital Products → Affiliate Commerce → Automation → Professional Creator OS → Ecosystem → Intelligence**
>
> **Important:** Do not start the next major release until the previous release passes its acceptance and rollout gates.

---

# 1. Starting Assumption

This LLD assumes V1 is already in production with:

```text
Authentication
Google login
Username onboarding
Profiles
Pages
LINK/TEXT/IMAGE blocks
Themes/templates
Social profiles
Media uploads
Public rendering
Publish/unpublish
Analytics
SEO
QR
Reports/moderation
Audit logs
Account deletion
Production deployment
Monitoring
Backups
```

V1 is therefore the identity/platform foundation.

The next product goal is:

> **Turn social traffic into measurable creator outcomes.**

---

# 2. Post‑V1 Release Sequence

```text
V1.1  Conversion Basics
V1.2  Smart Growth
V1.3  Audience Ownership

V2.0  Payments
V2.1  Services & Booking
V2.2  Digital Products

V2.5  Affiliate Commerce

V3.0  Automation

V4.0  Professional Creator OS

V5.0  Creator / Brand Ecosystem

V6.0  Intelligence
```

---

# 3. Architectural Principles for All Post‑V1 Releases

## 3.1 Keep modular monolith

Do not split services yet.

Continue:

```text
Next.js
   ↓
NestJS modular monolith
   ↓
PostgreSQL
   ↓
Redis / R2
```

Introduce workers/queues only when asynchronous workloads require them.

---

## 3.2 Preserve Page → Blocks

Existing model remains:

```text
Page
 └── PageBlock[]
```

Post‑V1 blocks extend this system rather than replacing it.

---

## 3.3 Add business domains beside Pages

Future domains become:

```text
User
├── Pages
├── Audience
├── Commerce
├── Integrations
├── Automations
└── Analytics
```

Do not store CRM/orders/etc. inside PageBlock JSON.

---

## 3.4 PageBlock stores presentation/reference data

Example:

```text
FORM block
→ references Form.id

PRODUCT block
→ references Product.id

BOOKING block
→ references BookingType.id
```

This prevents business logic from being trapped inside JSON.

---

# 4. New Block Registry Design

Upgrade block registry before V1.1.

Recommended definition:

```ts
export interface BlockDefinition<TContent = unknown> {
  type: BlockType;
  category: BlockCategory;
  intent: BlockIntent;
  schema: ZodSchema<TContent>;
  defaultContent: TContent;
  editorKey: string;
  rendererKey: string;
  analyticsEvents: string[];
  supportsVisibilityRules: boolean;
}
```

---

# 5. Block Categories

```ts
enum BlockCategory {
  CONTENT = "CONTENT",
  CONVERSION = "CONVERSION",
  COMMERCE = "COMMERCE",
  DYNAMIC = "DYNAMIC",
}
```

---

# 6. Block Intents

```ts
enum BlockIntent {
  VISIT = "VISIT",
  CONTACT = "CONTACT",
  SUBSCRIBE = "SUBSCRIBE",
  BOOK = "BOOK",
  BUY = "BUY",
  PAY = "PAY",
  SUPPORT = "SUPPORT",
  DOWNLOAD = "DOWNLOAD",
  WATCH = "WATCH",
  FOLLOW = "FOLLOW",
}
```

This supports the future intent-first editor.

---

# 7. Intent‑First Add Block UX

Instead of:

```text
Add block
→ LINK
→ FORM
→ PRODUCT
```

use:

```text
What do you want your visitor to do?

Visit something
Contact me
Join my audience
Book me
Buy something
Pay me
Support me
Download something
Watch/listen
Follow me
```

Mapping:

```text
VISIT      → LINK / SMART_LINK
CONTACT    → WHATSAPP / FORM / EMAIL / PHONE
SUBSCRIBE  → SUBSCRIBE
BOOK       → BOOKING
BUY        → PRODUCT
PAY        → PAYMENT
SUPPORT    → TIP / DONATION
DOWNLOAD   → LEAD_MAGNET / PRODUCT
WATCH      → YOUTUBE / VIDEO / SPOTIFY
FOLLOW     → SOCIAL
```

---

# 8. V1.1 — Conversion Basics

## Goal

Make Kachko produce leads and enquiries.

Primary differentiator:

```text
Instagram gives profile traffic.
Kachko turns traffic into contacts.
```

---

# 9. V1.1 Scope

Features:

```text
WHATSAPP block
FORM block
SUBSCRIBE block
Contact domain
Audience dashboard
CSV export
Conversion analytics
Anti-spam
```

---

# 10. V1.1 Database Design

## Contact

```prisma
model Contact {
  id             String        @id @default(uuid())
  ownerUserId    String
  name           String?
  email          String?
  phone          String?
  status         ContactStatus @default(NEW)
  source         String?
  sourceDetails  Json?
  marketingOptIn Boolean       @default(false)
  lastActivityAt DateTime?

  owner          User          @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)

  submissions    FormSubmission[]
  notes          ContactNote[]
  tags           ContactTag[]

  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@index([ownerUserId, createdAt])
  @@index([ownerUserId, email])
  @@index([ownerUserId, phone])
  @@index([ownerUserId, status])
}
```

---

# 11. Contact Status

```prisma
enum ContactStatus {
  NEW
  CONTACTED
  QUALIFIED
  WON
  LOST
}
```

---

# 12. Form

```prisma
model Form {
  id          String      @id @default(uuid())
  pageId      String
  name        String
  title       String?
  description String?
  submitLabel String       @default("Submit")
  successType FormSuccessType @default(MESSAGE)
  successConfig Json?
  isActive    Boolean      @default(true)

  page        Page        @relation(fields: [pageId], references: [id], onDelete: Cascade)
  fields      FormField[]
  submissions FormSubmission[]

  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([pageId])
}
```

---

# 13. Form Field

```prisma
model FormField {
  id         String    @id @default(uuid())
  formId     String
  type       FormFieldType
  label      String
  name       String
  placeholder String?
  required   Boolean   @default(false)
  position   Int
  config     Json?

  form       Form      @relation(fields: [formId], references: [id], onDelete: Cascade)

  @@index([formId, position])
}
```

Supported:

```prisma
enum FormFieldType {
  TEXT
  EMAIL
  PHONE
  TEXTAREA
  SELECT
  CHECKBOX
}
```

---

# 14. Form Submission

```prisma
model FormSubmission {
  id          String   @id @default(uuid())
  formId      String
  contactId   String?
  payload     Json
  attribution Json?
  ipHash      String?
  createdAt   DateTime @default(now())

  form        Form     @relation(fields: [formId], references: [id], onDelete: Cascade)
  contact     Contact? @relation(fields: [contactId], references: [id], onDelete: SetNull)

  @@index([formId, createdAt])
  @@index([contactId, createdAt])
}
```

---

# 15. Contact Note

```prisma
model ContactNote {
  id        String   @id @default(uuid())
  contactId String
  authorId  String
  note      String
  createdAt DateTime @default(now())

  contact   Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
}
```

---

# 16. Tagging

```prisma
model Tag {
  id          String @id @default(uuid())
  ownerUserId String
  name        String

  @@unique([ownerUserId, name])
}
```

```prisma
model ContactTag {
  contactId String
  tagId     String

  @@id([contactId, tagId])
}
```

---

# 17. V1.1 Block Types

Add:

```text
WHATSAPP
FORM
SUBSCRIBE
```

---

# 18. WHATSAPP Content Contract

```ts
export interface WhatsAppBlockContent {
  label: string;
  phoneNumber: string;
  messageTemplate?: string;
  campaign?: string;
}
```

Validation:

```text
E.164 normalized number
max message length
no unsupported placeholders
```

Allowed placeholders:

```text
{{page}}
{{service}}
{{campaign}}
```

---

# 19. FORM Content Contract

```ts
export interface FormBlockContent {
  formId: string;
  variant?: "CARD" | "INLINE";
}
```

Block only references Form.

---

# 20. SUBSCRIBE Content Contract

```ts
export interface SubscribeBlockContent {
  formId: string;
  title?: string;
  description?: string;
}
```

Internally use a Form with email field and marketing consent.

---

# 21. V1.1 API Design

## Forms

```text
GET    /api/v1/pages/:pageId/forms
POST   /api/v1/pages/:pageId/forms
GET    /api/v1/forms/:formId
PATCH  /api/v1/forms/:formId
DELETE /api/v1/forms/:formId
```

---

# 22. Form Field APIs

```text
POST   /api/v1/forms/:formId/fields
PATCH  /api/v1/forms/:formId/fields/:fieldId
DELETE /api/v1/forms/:formId/fields/:fieldId
POST   /api/v1/forms/:formId/fields/reorder
```

---

# 23. Public Submission API

```text
POST /api/v1/public/forms/:formId/submissions
```

Request:

```json
{
  "values": {
    "name": "Rahul",
    "email": "rahul@example.com",
    "message": "Need a website"
  },
  "marketingOptIn": false,
  "attribution": {
    "utmSource": "instagram"
  }
}
```

---

# 24. Public Submission Flow

```text
Request
 ↓
Rate limit
 ↓
Validate form active
 ↓
Validate fields
 ↓
Spam/risk checks
 ↓
Normalize email/phone
 ↓
Find existing Contact
 ↓
Create/update Contact
 ↓
Create FormSubmission
 ↓
Emit lead.created
 ↓
Track analytics
 ↓
Return success action
```

---

# 25. Contact Deduplication

Initial matching:

```text
ownerUserId + normalized email
OR
ownerUserId + normalized phone
```

Do not globally merge contacts across creators.

---

# 26. Audience API

```text
GET   /api/v1/audience/contacts
GET   /api/v1/audience/contacts/:contactId
PATCH /api/v1/audience/contacts/:contactId
POST  /api/v1/audience/contacts/:contactId/notes
POST  /api/v1/audience/contacts/:contactId/tags
DELETE /api/v1/audience/contacts/:contactId/tags/:tagId

GET /api/v1/audience/export
```

---

# 27. Audience Query Parameters

```text
status
tag
search
source
from
to
page
limit
```

---

# 28. V1.1 Analytics Events

Add:

```text
FORM_VIEW
FORM_SUBMIT
LEAD_CREATED
WHATSAPP_CLICK
SUBSCRIBE
```

---

# 29. Conversion Funnel API

```text
GET /api/v1/analytics/pages/:pageId/conversion-funnel
```

Response:

```json
{
  "data": {
    "visitors": 2840,
    "actions": 620,
    "leads": 93,
    "conversionRate": 3.27
  }
}
```

---

# 30. V1.1 Frontend Routes

```text
/dashboard/audience
/dashboard/audience/[contactId]
/dashboard/forms
```

---

# 31. V1.1 Frontend Tasks

## Intent Picker

- [ ] Build goal-based Add Block modal.
- [ ] Map intents to block types.
- [ ] Preserve existing direct block picker for advanced users.

## WhatsApp

- [ ] number input
- [ ] message template
- [ ] preview generated URL
- [ ] CTA styling

## Forms

- [ ] template picker
- [ ] form editor
- [ ] field reorder
- [ ] required toggle
- [ ] success message
- [ ] public renderer

## Audience

- [ ] contact table
- [ ] status filter
- [ ] search
- [ ] contact detail
- [ ] notes
- [ ] tags
- [ ] export

---

# 32. V1.1 Backend Tasks

- [ ] Contact schema
- [ ] Form schema
- [ ] migration
- [ ] form CRUD
- [ ] field CRUD/reorder
- [ ] public submission
- [ ] dedupe
- [ ] consent
- [ ] analytics events
- [ ] audience CRUD
- [ ] CSV export
- [ ] anti-spam
- [ ] domain events

---

# 33. V1.1 Security

Implement:

```text
IP/user rate limit
submission size limits
honeypot
optional CAPTCHA/risk challenge
email/phone normalization
HTML stripping
spam keyword heuristics
```

Do not allow forms to become open email-relay systems.

---

# 34. V1.1 Acceptance Criteria

```text
Creator adds WhatsApp block
→ visitor click recorded

Creator creates contact form
→ visitor submits
→ Contact created
→ creator sees contact

Visitor subscribes
→ marketing consent recorded

Creator exports audience CSV
```

Release gate:

```text
No cross-creator contact access
No form spam burst bypass
Analytics funnel matches submissions
```

---

# 35. V1.1 Rollout

Feature flags:

```text
intent_block_picker
forms
audience
whatsapp_block
subscribe_block
```

Rollout:

```text
internal
→ 5%
→ 25%
→ 100%
```

---

# 36. V1.2 — Smart Growth

## Goal

Make links and blocks context-aware.

Features:

```text
Scheduling
Expiry
Smart Links
Collections
UTM Attribution
Dynamic Blocks
```

---

# 37. Visibility Rules

Add fields to PageBlock:

```prisma
visibleFrom DateTime?
visibleUntil DateTime?
rules       Json?
```

Future-friendly `rules`:

```json
{
  "countries": ["IN"],
  "devices": ["MOBILE"],
  "sources": ["instagram"]
}
```

---

# 38. Block Visibility Service

Create:

```text
BlockVisibilityService
```

Input:

```text
block
requestContext
currentTime
```

Output:

```text
VISIBLE
HIDDEN
```

Must execute server-side for public rendering.

---

# 39. Smart Link Model

Prefer dedicated table:

```prisma
model SmartLink {
  id        String @id @default(uuid())
  blockId   String @unique
  fallbackUrl String
  rules     SmartLinkRule[]
}
```

---

# 40. Smart Link Rule

```prisma
model SmartLinkRule {
  id          String @id @default(uuid())
  smartLinkId String
  priority    Int
  condition   Json
  destinationUrl String

  @@index([smartLinkId, priority])
}
```

---

# 41. Initial Conditions

Support:

```text
COUNTRY
DEVICE
SOURCE
DATE_RANGE
```

Do not support arbitrary scripting.

---

# 42. Smart Link Resolution

```text
click
 ↓
resolve matching rule
 ↓
log resolution
 ↓
redirect
```

Route:

```text
GET /go/:token
```

Do not expose internal block IDs in public redirect URLs.

---

# 43. Collection Model

```prisma
model Collection {
  id           String @id @default(uuid())
  ownerUserId  String
  pageId       String?
  slug         String
  title        String
  description  String?
  coverMediaId String?
  isPublished  Boolean @default(false)

  items        CollectionItem[]

  @@unique([ownerUserId, slug])
}
```

---

# 44. Collection Item

```prisma
model CollectionItem {
  id           String @id @default(uuid())
  collectionId String
  itemType     CollectionItemType
  referenceId  String
  position     Int

  @@index([collectionId, position])
}
```

Initial types:

```text
LINK
BLOCK
```

Later:

```text
PRODUCT
AFFILIATE_PRODUCT
VIDEO
RESOURCE
```

---

# 45. Collections API

```text
GET    /api/v1/collections
POST   /api/v1/collections
GET    /api/v1/collections/:id
PATCH  /api/v1/collections/:id
DELETE /api/v1/collections/:id

POST /api/v1/collections/:id/items
POST /api/v1/collections/:id/reorder
```

Public:

```text
GET /api/v1/public/:username/collections/:slug
```

---

# 46. Attribution Model

Do not create UTM columns on every table.

Create normalized attribution payload.

Suggested helper:

```ts
interface AttributionContext {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  referrer?: string;
}
```

Attach to:

```text
AnalyticsEvent
FormSubmission
Future Payment/Order
Booking
AffiliateClick
```

---

# 47. Dynamic Content Sync

Initial integrations:

```text
YouTube
RSS
GitHub
```

Model:

```prisma
model ExternalFeed {
  id           String @id @default(uuid())
  ownerUserId  String
  provider     ExternalFeedProvider
  config       Json
  cachedData   Json?
  lastSyncAt   DateTime?
  nextSyncAt   DateTime?
  status       ExternalFeedStatus
}
```

---

# 48. Dynamic Sync Execution

Initially:

```text
scheduled worker
→ fetch remote data
→ validate
→ store cachedData
```

Public rendering:

```text
read cachedData
```

Do not call GitHub/YouTube/RSS synchronously for every visitor.

---

# 49. V1.2 Frontend Tasks

- [ ] schedule date/time
- [ ] expiry UI
- [ ] timezone display
- [ ] smart link rule builder
- [ ] collections dashboard
- [ ] collection editor
- [ ] collection public page
- [ ] dynamic block connectors
- [ ] attribution analytics

---

# 50. V1.2 Backend Tasks

- [ ] visibility rules
- [ ] server-side resolver
- [ ] smart link redirect
- [ ] collection models
- [ ] collection APIs
- [ ] external feed model
- [ ] sync worker
- [ ] UTM parser
- [ ] analytics breakdowns

---

# 51. V1.2 Acceptance Criteria

```text
Scheduled block appears at correct time
Expired block disappears
Smart link routes correctly
Collection is shareable
Dynamic feed failure does not break public page
UTM source flows into lead analytics
```

---

# 52. V1.3 — Audience Ownership

## Goal

Upgrade the Audience feature into a lightweight CRM.

---

# 53. Contact Activity

Add:

```prisma
model ContactActivity {
  id        String @id @default(uuid())
  contactId String
  type      ContactActivityType
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([contactId, createdAt])
}
```

Types:

```text
FORM_SUBMITTED
WHATSAPP_CLICKED
SUBSCRIBED
STATUS_CHANGED
NOTE_ADDED
TAG_ADDED
LEAD_MAGNET_DOWNLOADED
BOOKING_CREATED
PURCHASED
```

---

# 54. Contact Timeline

API:

```text
GET /api/v1/audience/contacts/:id/activity
```

Frontend:

```text
contact header
status
tags
notes
timeline
source
```

---

# 55. Lead Magnet Model

```prisma
model LeadMagnet {
  id           String @id @default(uuid())
  ownerUserId  String
  title        String
  description  String?
  mediaId      String
  isActive     Boolean @default(true)
}
```

---

# 56. Lead Magnet Block

Content:

```ts
interface LeadMagnetBlockContent {
  leadMagnetId: string;
  formId: string;
  label?: string;
}
```

Flow:

```text
submit
→ contact
→ consent
→ secure download link
→ activity
```

---

# 57. CRM Features

Add:

```text
status
tags
notes
search
filters
source
timeline
export
```

Do not add:
- complex opportunity pipelines
- custom objects
- sales forecasting

yet.

---

# 58. V1.3 Acceptance Criteria

```text
Contact history visible
Lead magnet delivery works
Creator can segment by status/tag/source
Creator can export audience
Contact events are correctly attributed
```

---

# 59. V2.0 — Payments

## Goal

Enable direct creator monetization.

---

# 60. Payment Domain Boundary

Create Nest module:

```text
payments/
├── payments.controller.ts
├── payments.service.ts
├── payment-provider.interface.ts
├── providers/
│   └── razorpay.provider.ts
├── webhooks/
└── repositories/
```

---

# 61. Payment Intent

```prisma
model PaymentIntent {
  id                 String @id @default(uuid())
  creatorUserId      String
  amount             Decimal
  currency           String
  purpose            String?
  status             PaymentIntentStatus
  provider           PaymentProviderType
  providerReference  String?
  metadata           Json?
  expiresAt          DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([creatorUserId, createdAt])
}
```

---

# 62. Payment

```prisma
model Payment {
  id                String @id @default(uuid())
  paymentIntentId   String
  providerPaymentId String
  amount            Decimal
  currency          String
  status            PaymentStatus
  capturedAt        DateTime?
  failedAt          DateTime?
  refundedAmount    Decimal @default(0)
  createdAt         DateTime @default(now())

  @@unique([providerPaymentId])
}
```

---

# 63. Payment Link

```prisma
model PaymentLink {
  id                String @id @default(uuid())
  creatorUserId     String
  slug              String
  title             String
  description       String?
  fixedAmount       Decimal?
  allowCustomAmount Boolean @default(false)
  minAmount         Decimal?
  maxAmount         Decimal?
  active            Boolean @default(true)

  @@unique([creatorUserId, slug])
}
```

---

# 64. Payment Provider Interface

```ts
export interface PaymentProvider {
  createIntent(input: CreateProviderPaymentInput): Promise<ProviderPayment>;
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedPaymentEvent>;
  getPayment(providerPaymentId: string): Promise<ProviderPaymentStatus>;
  refund(input: RefundInput): Promise<ProviderRefund>;
}
```

---

# 65. Payment Webhooks

Route:

```text
POST /api/v1/webhooks/payments/:provider
```

Requirements:

```text
signature verification
idempotency
raw-body support
event persistence
retry-safe processing
```

---

# 66. Payment Event Model

```prisma
model PaymentWebhookEvent {
  id              String @id @default(uuid())
  provider        PaymentProviderType
  externalEventId String
  eventType       String
  payloadHash     String
  processedAt     DateTime?
  createdAt       DateTime @default(now())

  @@unique([provider, externalEventId])
}
```

---

# 67. Payment Block

Types:

```text
PAYMENT
TIP
DONATION
```

Content references PaymentLink.

---

# 68. V2.0 APIs

```text
GET/POST /api/v1/payment-links
GET/PATCH/DELETE /api/v1/payment-links/:id

POST /api/v1/public/payment-links/:username/:slug/intents

GET /api/v1/payments
GET /api/v1/payments/:id
POST /api/v1/payments/:id/refund
```

---

# 69. V2.0 Security

Must-have:

```text
webhook verification
idempotency
server-controlled amount
provider reconciliation
no card storage
no client-trusted success
refund authorization
```

---

# 70. V2.0 Acceptance Criteria

```text
Payment cannot be forged client-side
Duplicate webhook does not duplicate payment
Creator sees transaction
Refund updates state
Analytics captures payment funnel
```

---

# 71. V2.1 — Services & Booking

## Models

```text
Service
BookingType
AvailabilityRule
Booking
```

---

# 72. BookingType

```prisma
model BookingType {
  id              String @id @default(uuid())
  creatorUserId   String
  title           String
  description     String?
  durationMinutes Int
  priceAmount     Decimal?
  currency        String?
  bufferBefore    Int @default(0)
  bufferAfter     Int @default(0)
  active          Boolean @default(true)
}
```

---

# 73. Availability

```prisma
model AvailabilityRule {
  id              String @id @default(uuid())
  bookingTypeId   String
  dayOfWeek       Int
  startTime       String
  endTime         String
  timezone        String
}
```

---

# 74. Booking

```prisma
model Booking {
  id            String @id @default(uuid())
  bookingTypeId String
  contactId     String
  startsAt      DateTime
  endsAt        DateTime
  status        BookingStatus
  paymentId     String?
  meetingUrl    String?
  createdAt     DateTime @default(now())

  @@index([bookingTypeId, startsAt])
}
```

---

# 75. Booking Race Prevention

When creating booking:

```text
BEGIN
→ validate slot
→ lock overlapping range/resource
→ create booking
COMMIT
```

Use transaction and unique/conflict strategy.

Never rely on frontend availability only.

---

# 76. Booking APIs

```text
GET/POST /api/v1/booking-types
PATCH /api/v1/booking-types/:id

GET /api/v1/public/booking-types/:id/availability
POST /api/v1/public/booking-types/:id/book

GET /api/v1/bookings
PATCH /api/v1/bookings/:id/cancel
```

---

# 77. V2.2 — Digital Products

## Models

```text
Product
Price
DigitalAsset
Order
OrderItem
Entitlement
Coupon
```

---

# 78. Product

```prisma
model Product {
  id             String @id @default(uuid())
  creatorUserId  String
  slug           String
  title          String
  description    String?
  type           ProductType
  status         ProductStatus
  coverMediaId   String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([creatorUserId, slug])
}
```

---

# 79. Order

```prisma
model Order {
  id            String @id @default(uuid())
  creatorUserId String
  contactId     String?
  status        OrderStatus
  subtotal      Decimal
  discount      Decimal @default(0)
  total         Decimal
  currency      String
  paymentId     String?
  createdAt     DateTime @default(now())
}
```

---

# 80. Entitlement

```prisma
model Entitlement {
  id         String @id @default(uuid())
  orderId    String
  productId  String
  contactId  String
  expiresAt  DateTime?
  revokedAt  DateTime?
  createdAt  DateTime @default(now())
}
```

---

# 81. Secure Download Flow

```text
request download
→ validate entitlement
→ create short-lived signed R2 URL
→ log download
```

Never expose permanent private R2 object URLs.

---

# 82. Storefront Routes

```text
/:username/shop
/:username/product/:slug
```

---

# 83. V2.5 — Affiliate Commerce

## Models

```text
Merchant
AffiliateProgram
AffiliateLink
AffiliateClick
AffiliateConversion
Commission
```

---

# 84. Affiliate Link

```prisma
model AffiliateLink {
  id             String @id @default(uuid())
  creatorUserId  String
  merchantId     String
  slug           String @unique
  destinationUrl String
  trackingUrl    String
  metadata       Json?
  active         Boolean @default(true)
}
```

---

# 85. Redirect Service

Route:

```text
GET /go/:slug
```

Flow:

```text
lookup
→ validate
→ record click asynchronously
→ redirect immediately
```

Keep redirect latency extremely low.

---

# 86. Affiliate Conversion

Use:

```text
external conversion id
attribution window
last eligible click
```

Must dedupe provider conversions.

---

# 87. V3.0 — Automation

Do not implement until:

```text
contacts
payments/orders
bookings
domain events
```

are stable.

---

# 88. Automation Model

```prisma
model Automation {
  id            String @id @default(uuid())
  creatorUserId String
  name          String
  status        AutomationStatus
  trigger       Json
  conditions    Json?
  actions       Json
  version       Int @default(1)
}
```

---

# 89. Execution

```prisma
model AutomationExecution {
  id           String @id @default(uuid())
  automationId String
  eventId      String
  status       AutomationExecutionStatus
  result       Json?
  error        Json?
  startedAt    DateTime
  completedAt  DateTime?
}
```

---

# 90. Queue / Worker

Introduce:

```text
API
 ↓
Queue
 ↓
Worker
```

Jobs:

```text
email
webhook
automation
external sync
digital delivery
```

---

# 91. Connector Framework

```ts
interface Connector {
  provider: string;
  capabilities: ConnectorCapability[];
  execute(action: string, payload: unknown): Promise<unknown>;
}
```

Connections should store encrypted credentials.

---

# 92. Webhooks

Creator-configured endpoint:

```text
POST external URL
```

Payload:

```json
{
  "id": "event-id",
  "type": "lead.created",
  "createdAt": "...",
  "data": {}
}
```

Sign with HMAC.

---

# 93. API Keys

Store only hash.

Fields:

```text
id
owner
name
keyPrefix
keyHash
scopes
lastUsedAt
revokedAt
```

---

# 94. V4.0 — Professional Creator OS

Domains:

```text
Workspace
MediaKit
BrandInquiry
Deal
Proposal
Invoice
```

Add only after creator/business usage justifies it.

---

# 95. V5.0 — Creator / Brand Ecosystem

Requires:

```text
large active creator supply
reliable analytics
fraud controls
payments/payouts
moderation
```

Introduce:

```text
Brand
Campaign
CampaignCreator
Deliverable
Payout
DiscoveryProfile
```

Do not implement early.

---

# 96. V6.0 — Intelligence

AI architecture:

```text
analytics data
   ↓
feature aggregation
   ↓
rules/models
   ↓
recommendation service
   ↓
creator approval
```

Never auto-publish destructive AI changes.

---

# 97. Shared Domain Events

Define early:

```text
contact.created
contact.updated
form.submitted
subscriber.created
payment.completed
payment.failed
booking.created
booking.cancelled
order.paid
product.purchased
affiliate.clicked
affiliate.converted
```

---

# 98. Event Interface

```ts
export interface DomainEvent<T> {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  payload: T;
}
```

Initially:

```text
in-process event dispatcher
```

Later:

```text
queue/event bus
```

---

# 99. Analytics Event Evolution

Keep current:

```text
PAGE_VIEW
LINK_CLICK
SOCIAL_CLICK
```

Add gradually:

```text
BLOCK_IMPRESSION
WHATSAPP_CLICK
FORM_VIEW
FORM_SUBMIT
LEAD_CREATED
SUBSCRIBE

SMART_LINK_RESOLVED
COLLECTION_VIEW
COLLECTION_ITEM_CLICK

PAYMENT_STARTED
PAYMENT_COMPLETED
PAYMENT_FAILED

BOOKING_VIEW
BOOKING_CREATED

PRODUCT_VIEW
CHECKOUT_STARTED
PURCHASE

AFFILIATE_CLICK
AFFILIATE_CONVERSION
```

---

# 100. Analytics Storage Strategy

Do not immediately add ClickHouse.

Use:

```text
PostgreSQL
```

until:

```text
event volume
query latency
storage growth
```

prove it is necessary.

Then evolve:

```text
API
→ queue
→ worker
→ analytical store
```

---

# 101. Redis Strategy

Current uses:

```text
rate limiting
page cache
```

Post‑V1 additions:

```text
submission throttling
idempotency
locks
queue backing
automation retries
```

Permanent business data remains PostgreSQL.

---

# 102. Background Worker Introduction

Introduce worker no earlier than V1.2/V2 when needed.

Recommended app:

```text
apps/worker
```

Modules:

```text
email
external-feed-sync
payment-reconciliation
automation
webhook-delivery
digital-delivery
```

---

# 103. Post‑V1 Repository Growth

```text
apps/
├── kachko-fe
├── api
└── worker        # add when required

packages/
├── types
├── validation
├── ui
├── config
├── events
└── integrations
```

---

# 104. Feature Flags

Add/maintain:

```text
intent_block_picker
whatsapp_block
forms
audience
subscribe_block

scheduled_blocks
smart_links
collections
dynamic_blocks

payments
tips

bookings
digital_products

affiliate_commerce

automation
public_api

media_kits
brand_marketplace

ai_page_builder
ai_recommendations
```

---

# 105. Migration Rules

For every release:

```text
migration reviewed
backward compatible first
deploy schema
deploy code
backfill if needed
remove old schema later
```

Use expand/contract for destructive changes.

---

# 106. API Versioning

Continue:

```text
/api/v1
```

Do NOT create `/api/v2` just because product version becomes V2.

API version changes only for breaking API contract generations.

---

# 107. Ownership Rules

Every creator-owned entity must include/derive:

```text
ownerUserId
or
page.userId
or
workspaceId
```

Every protected endpoint verifies ownership.

Never trust IDs from client.

---

# 108. Rate Limit Strategy

Separate scopes:

```text
auth
public forms
analytics
payments
bookings
affiliate redirects
webhooks
API keys
```

Redis key example:

```text
rate:form:{formId}:{ipHash}
```

---

# 109. Audit Logging

Audit:

```text
contact export
payment refund
product deletion
booking cancellation
integration connection
API key creation/revocation
automation enable/disable
workspace role change
```

Do not audit every harmless public page read.

---

# 110. Testing Pyramid

Each feature:

## Unit
Business rules.

## Integration
DB + service + API.

## E2E
User journey.

## Contract
Shared FE/BE DTO expectations.

---

# 111. V1.1 E2E

```text
creator login
→ add contact form
→ publish
→ anonymous visitor submits
→ creator opens audience
→ sees contact
```

---

# 112. V1.2 E2E

```text
creator adds scheduled smart link
→ publish
→ visitor context matches rule
→ correct redirect
→ attribution visible
```

---

# 113. V2.0 E2E

Use provider sandbox:

```text
payment page
→ checkout
→ webhook
→ payment marked paid
→ creator dashboard
```

---

# 114. V2.1 E2E

```text
create booking type
→ visitor chooses slot
→ pay if required
→ booking confirmed
→ creator sees booking
```

---

# 115. V2.2 E2E

```text
create digital product
→ buy
→ payment confirmed
→ entitlement created
→ secure download
```

---

# 116. Observability Additions

Track new metrics:

```text
form submission success
spam rejected
lead creation rate
payment webhook failures
payment reconciliation mismatch
booking conflicts
digital delivery failures
affiliate redirect latency
automation execution failure
```

---

# 117. Post‑V1 Release Checklist

Every release must include:

```text
Schema
Migration
API contract
Swagger/OpenAPI
Shared DTOs
Backend tests
Frontend tests
E2E
Feature flag
Telemetry
Rate limits
Security review
Docs
Rollback plan
```

---

# 118. Team Execution Model

Continue parallel FE/BE workflow.

## Backend owner

```text
schema
contracts
API
migrations
security
infra
tests
```

## Frontend owner

```text
screens
editor
public renderer
API integration
mobile/accessibility
E2E browser journey
```

Shared:

```text
contract review
acceptance criteria
production verification
```

---

# 119. Post‑V1 Sprint Plan

## Sprint 1

Backend:
```text
Contact
Form
FormField
FormSubmission
public submit API
```

Frontend:
```text
intent-first picker
form editor shell
public form
```

---

# 120. Sprint 2

Backend:
```text
Audience APIs
dedupe
notes
tags
CSV export
```

Frontend:
```text
Audience list
contact detail
filters
export
```

---

# 121. Sprint 3

Backend:
```text
WHATSAPP block
SUBSCRIBE
conversion events
funnel aggregation
anti-spam
```

Frontend:
```text
WhatsApp editor
subscribe editor
conversion dashboard
```

Release:

```text
V1.1
```

---

# 122. Sprint 4

```text
scheduling
expiry
visibility service
```

---

# 123. Sprint 5

```text
smart links
redirect service
UTM attribution
```

---

# 124. Sprint 6

```text
collections
dynamic feed foundation
```

Release:

```text
V1.2
```

---

# 125. Sprint 7

```text
contact activity
lead magnets
CRM polish
```

Release:

```text
V1.3
```

---

# 126. V2 Development Gate

Do not start payments until:

```text
Audience model stable
Conversion events stable
Production telemetry stable
Webhooks/idempotency design reviewed
```

---

# 127. Product Success Gates

## V1.1

Need evidence:

```text
Creators add conversion blocks
Visitors submit forms
Creators return to view leads
```

## V1.2

Need evidence:

```text
Creators use scheduling/smart links
Attribution provides useful insight
```

## V1.3

Need evidence:

```text
Creators repeatedly use Audience
```

Only then heavily invest in commerce.

---

# 128. Monetization Rollout

Do not monetize every new feature immediately.

Recommended:

## Free
```text
basic form
WhatsApp
limited contacts
basic analytics
```

## Pro
```text
advanced appearance
scheduling
smart links
advanced analytics
```

## Growth
```text
CRM
higher contact limits
lead magnets
integrations
```

## Business
```text
payments
products
bookings
lower transaction fee
```

---

# 129. Technical Debt Gates

Before each major release review:

```text
slow queries
Prisma schema quality
API consistency
duplicate services
shared validation
client bundle growth
test runtime
Redis key design
observability gaps
```

Do not let product speed destroy maintainability.

---

# 130. Public Page Performance Rule

Even after adding:

```text
forms
commerce
bookings
affiliate
personalization
```

public pages must remain:

```text
server-first
minimal JS
cache-friendly
fast image delivery
```

Dashboard complexity must never leak into public bundle by default.

---

# 131. Security Review by Release

## V1.1
Spam/PII.

## V1.2
Redirect abuse/open redirects.

## V2.0
Payments/webhooks.

## V2.1
Booking race conditions.

## V2.2
Paid-content access.

## V2.5
Affiliate fraud.

## V3
OAuth credentials/automation abuse.

---

# 132. Recommended Next Code Modules

Immediate:

```text
apps/api/src/modules/
├── audience/
├── forms/
└── contacts/
```

Then:

```text
smart-links/
collections/
external-feeds/
```

Then:

```text
payments/
bookings/
products/
orders/
```

---

# 133. Recommended Next Frontend Features

Immediate:

```text
features/
├── intent-picker/
├── forms/
├── audience/
└── whatsapp/
```

Then:

```text
smart-links/
collections/
conversion-analytics/
```

---

# 134. Recommended Shared Contracts

Add:

```text
packages/types/src/
├── audience.ts
├── forms.ts
├── contacts.ts
├── attribution.ts
└── domain-events.ts
```

Later:

```text
payments.ts
bookings.ts
products.ts
orders.ts
automation.ts
```

---

# 135. First Post‑V1 Milestone

The first milestone after production should be:

```text
Creator
→ adds "Contact Me"
→ publishes
→ visitor submits
→ Contact created
→ creator sees lead
```

This is more strategically important than adding another theme or embed.

---

# 136. Second Milestone

```text
Instagram visitor
→ Kachko
→ visitor becomes lead
→ source = Instagram
→ creator sees conversion rate
```

Now analytics describes business outcomes.

---

# 137. Third Milestone

```text
Visitor
→ chooses service
→ pays
→ becomes customer
```

This is the transition from:

```text
link-in-bio
```

to:

```text
creator business platform
```

---

# 138. Definition of Done for the Post‑V1 Platform Foundation

Before declaring the post‑V1 foundation successful:

```text
Intent-first editor works
Audience domain exists
Contacts are owned/exportable
Conversion events are reliable
Smart visibility rules work
Attribution survives through conversion
Payments are provider-agnostic
Async worker path exists
Domain events support automation
Public page remains fast
```

---

# 139. Final Recommended Execution Order

```text
PRODUCTION V1
    ↓
Production stabilization
    ↓
Intent-first block picker
    ↓
Contact model
    ↓
Forms
    ↓
WhatsApp
    ↓
Subscribe
    ↓
Audience dashboard
    ↓
Conversion analytics
    ↓
V1.1
    ↓
Scheduling
    ↓
Smart links
    ↓
Collections
    ↓
Attribution
    ↓
V1.2
    ↓
CRM activity
    ↓
Lead magnets
    ↓
V1.3
    ↓
Payments
    ↓
V2.0
    ↓
Booking/services
    ↓
V2.1
    ↓
Digital products
    ↓
V2.2
    ↓
Affiliate commerce
    ↓
V2.5
    ↓
Automation
    ↓
V3
```

---

# 140. Immediate Next Tasks After V1 Goes Live

Start with these exact tasks:

```text
1. Add block category + intent metadata.
2. Build intent-first Add Block UI.
3. Add Contact schema.
4. Add Form/FormField/FormSubmission schemas.
5. Add form CRUD contracts.
6. Add public form submission endpoint.
7. Add contact deduplication.
8. Add Audience APIs.
9. Build FORM block.
10. Build WHATSAPP block.
11. Build SUBSCRIBE block.
12. Add Audience dashboard.
13. Add CSV export.
14. Add FORM_VIEW / FORM_SUBMIT / LEAD_CREATED / WHATSAPP_CLICK analytics.
15. Add conversion funnel dashboard.
16. Add spam/rate protection.
17. Ship behind feature flags.
18. Measure adoption and retention.
```

That is the recommended first development cycle on top of the current V1 production architecture.
