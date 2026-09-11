# kachko — Low-Level Design (LLD)

**Document status:** Implementation baseline for V1  
**Companion document:** `01-HLD.md`  
**Primary language:** TypeScript  
**Repository:** Turborepo + pnpm

---

# 1. Repository Structure

```text
kachko/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── (marketing)/
│   │   │   ├── (auth)/
│   │   │   ├── dashboard/
│   │   │   ├── [username]/
│   │   │   ├── admin/
│   │   │   ├── api/
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── editor/
│   │   │   ├── links/
│   │   │   ├── profile/
│   │   │   ├── appearance/
│   │   │   └── analytics/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── middleware.ts
│   │
│   └── api/
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── pages/
│       │   │   ├── blocks/
│       │   │   ├── themes/
│       │   │   ├── social/
│       │   │   ├── media/
│       │   │   ├── analytics/
│       │   │   ├── qr/
│       │   │   ├── imports/
│       │   │   ├── moderation/
│       │   │   ├── admin/
│       │   │   └── health/
│       │   ├── common/
│       │   ├── config/
│       │   ├── database/
│       │   ├── app.module.ts
│       │   └── main.ts
│       └── test/
│
├── packages/
│   ├── ui/
│   ├── types/
│   ├── validation/
│   ├── config/
│   ├── eslint-config/
│   └── tsconfig/
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── infrastructure/
│   ├── docker/
│   ├── terraform/
│   └── scripts/
│
├── docs/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

# 2. Backend Module Design

Every business module follows:

```text
module/
├── controller.ts
├── service.ts
├── repository.ts
├── module.ts
├── dto/
│   ├── create.dto.ts
│   ├── update.dto.ts
│   └── response.dto.ts
├── schemas/
├── types/
└── tests/
```

Dependency direction:

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
PrismaService
    ↓
PostgreSQL
```

Controllers must not contain business logic or direct Prisma calls.

---

# 3. Prisma Data Model

## 3.1 User

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  username      String    @unique
  passwordHash  String?
  displayName   String?
  avatarUrl     String?
  bio           String?
  role          UserRole  @default(USER)
  isVerified    Boolean   @default(false)
  isActive      Boolean   @default(true)
  deletedAt     DateTime?

  sessions      Session[]
  pages         Page[]
  media         Media[]
  auditLogs     AuditLog[]
  reports       Report[]  @relation("Reporter")

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([email])
  @@index([username])
  @@index([createdAt])
}

enum UserRole {
  USER
  MODERATOR
  ADMIN
}
```

---

# 4. Sessions

```prisma
model Session {
  id           String   @id @default(uuid())
  userId       String
  tokenHash    String   @unique
  expiresAt    DateTime
  lastUsedAt   DateTime?
  revokedAt    DateTime?
  ipHash       String?
  userAgent    String?

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}
```

The raw session token is never stored in the database; only a cryptographic hash is persisted.

---

# 5. Pages

```prisma
model Page {
  id           String          @id @default(uuid())
  userId       String
  slug         String          @unique
  title        String?
  description  String?
  isPublished  Boolean         @default(false)
  publishedAt  DateTime?
  themeId      String?

  user         User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  theme        Theme?          @relation(fields: [themeId], references: [id], onDelete: SetNull)
  blocks       PageBlock[]
  socials      SocialProfile[]
  domains      Domain[]

  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@index([userId])
  @@index([userId, updatedAt])
  @@index([isPublished])
}
```

---

# 6. Page Blocks

```prisma
model PageBlock {
  id          String    @id @default(uuid())
  pageId      String
  type        BlockType
  position    Int
  isVisible   Boolean   @default(true)
  content     Json

  page        Page      @relation(fields: [pageId], references: [id], onDelete: Cascade)
  analytics   AnalyticsEvent[]

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([pageId, position])
  @@index([pageId, isVisible, position])
}

enum BlockType {
  LINK
  TEXT
  IMAGE
  VIDEO
  SOCIAL
  DIVIDER
  YOUTUBE
  SPOTIFY
  EMAIL
  PHONE
  LOCATION
}
```

---

# 7. Themes

```prisma
model Theme {
  id          String   @id @default(uuid())
  name        String
  slug        String   @unique
  isSystem    Boolean  @default(true)

  background  Json
  typography  Json
  buttons     Json
  cards       Json

  pages       Page[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

# 8. Social Profiles

```prisma
model SocialProfile {
  id          String   @id @default(uuid())
  pageId      String
  platform    SocialPlatform
  username    String?
  url         String
  position    Int
  isVisible   Boolean  @default(true)

  page        Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([pageId, position])
}

enum SocialPlatform {
  INSTAGRAM
  YOUTUBE
  X
  LINKEDIN
  FACEBOOK
  TIKTOK
  GITHUB
  DISCORD
  TWITCH
  SPOTIFY
}
```

---

# 9. Media

```prisma
model Media {
  id          String   @id @default(uuid())
  userId      String
  storageKey  String   @unique
  url         String
  mimeType    String
  size        BigInt
  width       Int?
  height      Int?

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
}
```

---

# 10. Analytics Events

```prisma
model AnalyticsEvent {
  id          String      @id @default(uuid())
  pageId      String
  blockId     String?
  eventType   AnalyticsEventType

  ipHash      String?
  country     String?
  city        String?
  device      String?
  browser     String?
  os          String?
  referrer    String?

  createdAt   DateTime    @default(now())

  page        Page        @relation(fields: [pageId], references: [id], onDelete: Cascade)
  block       PageBlock?  @relation(fields: [blockId], references: [id], onDelete: SetNull)

  @@index([pageId, createdAt])
  @@index([pageId, eventType, createdAt])
  @@index([eventType, createdAt])
}

enum AnalyticsEventType {
  PAGE_VIEW
  LINK_CLICK
  SOCIAL_CLICK
}
```

For large scale, partition this table by time and/or migrate analytics to ClickHouse.

---

# 11. Domains

```prisma
model Domain {
  id          String   @id @default(uuid())
  pageId      String
  domain      String   @unique
  verified    Boolean  @default(false)
  verificationToken String?
  verifiedAt  DateTime?

  page        Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([pageId])
}
```

Custom domains are not required for V1 but the model is reserved now.

---

# 12. Audit Logs

```prisma
model AuditLog {
  id            String   @id @default(uuid())
  userId        String?
  action        String
  resourceType  String
  resourceId    String?
  metadata      Json?

  user          User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  createdAt     DateTime @default(now())

  @@index([userId, createdAt])
  @@index([resourceType, resourceId])
}
```

---

# 13. Reports

```prisma
model Report {
  id          String       @id @default(uuid())
  reporterId  String
  pageId      String?
  reason      ReportReason
  details     String?
  status      ReportStatus @default(OPEN)

  reporter    User         @relation("Reporter", fields: [reporterId], references: [id], onDelete: Cascade)

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([status, createdAt])
  @@index([pageId])
}

enum ReportReason {
  SPAM
  PHISHING
  MALWARE
  HARASSMENT
  NSFW
  COPYRIGHT
  OTHER
}

enum ReportStatus {
  OPEN
  REVIEWING
  RESOLVED
  REJECTED
}
```

---

# 14. Feature Flags

```prisma
model FeatureFlag {
  id          String   @id @default(uuid())
  key         String   @unique
  enabled     Boolean  @default(false)
  description String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

# 15. Database Relationship Diagram

```text
User
 │
 ├──────────────< Session
 │
 ├──────────────< Page
 │                  │
 │                  ├────── Theme
 │                  │
 │                  ├──────< PageBlock
 │                  │             │
 │                  │             └──────< AnalyticsEvent
 │                  │
 │                  ├──────< SocialProfile
 │                  │
 │                  └──────< Domain
 │
 ├──────────────< Media
 │
 └──────────────< AuditLog

User ─────────────< Report
```

---

# 16. Block JSON Contracts

## LINK

```typescript
export interface LinkBlockContent {
  title: string;
  url: string;
  icon?: string;
  thumbnailMediaId?: string;
  openInNewTab?: boolean;
  style?: {
    variant: "solid" | "outline" | "glass";
  };
}
```

## TEXT

```typescript
export interface TextBlockContent {
  text: string;
  alignment: "left" | "center" | "right";
}
```

## IMAGE

```typescript
export interface ImageBlockContent {
  mediaId: string;
  alt: string;
  href?: string;
}
```

## VIDEO

```typescript
export interface VideoBlockContent {
  provider: "youtube" | "vimeo" | "direct";
  url: string;
  title?: string;
}
```

---

# 17. Validation

Use Zod in shared package:

```typescript
export const LinkBlockSchema = z.object({
  title: z.string().trim().min(1).max(100),
  url: z.string().url(),
  icon: z.string().max(50).optional(),
  thumbnailMediaId: z.string().uuid().optional(),
  openInNewTab: z.boolean().optional(),
});
```

URL scheme validation must additionally reject unsafe schemes.

A useful server-side helper:

```typescript
export function assertSafeUrl(value: string): URL {
  const url = new URL(value);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new BadRequestException("Unsupported URL scheme");
  }

  return url;
}
```

Special blocks such as email/phone should have their own validators.

---

# 18. Username Rules

Normalize to lowercase.

Recommended rules:

```text
Length: 3–30
Allowed: a-z, 0-9, underscore, hyphen, period
```

Reserved names:

```text
admin
api
app
auth
login
logout
register
signup
dashboard
settings
support
help
about
privacy
terms
status
cdn
static
www
```

Repository operation:

```typescript
findByUsername(username: string)
```

Registration must perform a unique DB write and handle unique-constraint races rather than relying only on an availability check.

---

# 19. API Contract

Base:

```text
/api/v1
```

Response envelope:

```typescript
interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

---

# 20. Authentication APIs

```text
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
GET  /auth/me
POST /auth/forgot-password
POST /auth/reset-password
GET  /auth/oauth/:provider
GET  /auth/oauth/:provider/callback
```

Register request:

```json
{
  "email": "user@example.com",
  "password": "strong-password",
  "username": "rohan"
}
```

Successful response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "rohan"
    }
  }
}
```

Session cookie is set using secure HTTP-only attributes.

---

# 21. User APIs

```text
GET   /users/me
PATCH /users/me
PATCH /users/me/username
POST  /users/me/avatar/upload-url
```

Authorization:

```text
Current authenticated user only
```

---

# 22. Page APIs

```text
GET    /pages
POST   /pages
GET    /pages/:pageId
PATCH  /pages/:pageId
DELETE /pages/:pageId

POST   /pages/:pageId/publish
POST   /pages/:pageId/unpublish

GET    /public/:username
```

Create:

```json
{
  "slug": "rohan",
  "title": "Rohan",
  "description": "Software Developer"
}
```

---

# 23. Public Page API

```text
GET /public/:username
```

Only return public-safe data.

Example:

```json
{
  "success": true,
  "data": {
    "profile": {
      "username": "rohan",
      "displayName": "Rohan",
      "avatarUrl": "https://cdn.example/...",
      "bio": "Software Developer"
    },
    "theme": {},
    "socials": [],
    "blocks": []
  }
}
```

Never expose:

- password hash
- session information
- private audit data
- unpublished blocks
- internal moderation fields

---

# 24. Block APIs

```text
GET    /pages/:pageId/blocks
POST   /pages/:pageId/blocks
PATCH  /blocks/:blockId
DELETE /blocks/:blockId
PATCH  /pages/:pageId/blocks/reorder
```

Create:

```json
{
  "type": "LINK",
  "content": {
    "title": "My YouTube",
    "url": "https://youtube.com/example"
  }
}
```

---

# 25. Reorder API

```text
PATCH /pages/:pageId/blocks/reorder
```

Request:

```json
{
  "items": [
    { "id": "block-a", "position": 0 },
    { "id": "block-c", "position": 1 },
    { "id": "block-b", "position": 2 }
  ]
}
```

Implementation must verify that every supplied block belongs to the page.

Use a transaction:

```text
BEGIN
  update block A
  update block B
  update block C
COMMIT
```

If positions can temporarily collide, use a two-phase position update or a safe SQL strategy inside the transaction.

---

# 26. Theme APIs

```text
GET /themes
GET /themes/:themeId
```

Admin:

```text
POST   /themes
PATCH  /themes/:themeId
DELETE /themes/:themeId
```

System themes are read-only for normal users.

---

# 27. Social APIs

```text
GET    /pages/:pageId/socials
POST   /pages/:pageId/socials
PATCH  /socials/:socialId
DELETE /socials/:socialId
PATCH  /pages/:pageId/socials/reorder
```

Validate URL and platform independently.

---

# 28. Media APIs

```text
POST   /media/upload-url
POST   /media/complete
GET    /media
DELETE /media/:mediaId
```

Recommended flow:

```text
Browser
 ↓
POST /media/upload-url
 ↓
API returns pre-signed upload
 ↓
Browser uploads directly to R2
 ↓
POST /media/complete
 ↓
API validates metadata and creates Media row
```

Enforce:

- MIME allowlist
- maximum file size
- authenticated ownership
- image dimension limits
- filename normalization

---

# 29. Analytics APIs

```text
POST /analytics/events
GET  /pages/:pageId/analytics/summary
GET  /pages/:pageId/analytics/timeseries
GET  /pages/:pageId/analytics/top-links
GET  /pages/:pageId/analytics/geo
GET  /pages/:pageId/analytics/devices
```

Event:

```json
{
  "pageId": "uuid",
  "blockId": "uuid",
  "eventType": "LINK_CLICK"
}
```

Server derives request metadata rather than trusting browser-provided country/device fields where possible.

---

# 30. Analytics Privacy

Recommended V1:

```text
Raw IP
  ↓
normalize
  ↓
hash with server-side salt
  ↓
store hash only
```

Do not expose individual visitor identity.

Use aggregation for dashboard responses.

---

# 31. QR API

```text
GET /pages/:pageId/qr?format=png
GET /pages/:pageId/qr?format=svg
```

The server generates QR content from the canonical public URL.

Cache QR output where useful.

---

# 32. Import API

```text
POST /imports/linktree
GET  /imports/:importId
```

Flow:

```text
User supplies public URL
        ↓
Validate URL
        ↓
Fetch if allowed
        ↓
Parse supported public content
        ↓
Normalize into internal blocks
        ↓
Preview import
        ↓
User confirms
        ↓
Create blocks
```

Respect target-site terms, robots policies and access controls. Do not bypass restrictions.

---

# 33. NestJS Module Layout

```text
src/modules/pages/
├── pages.module.ts
├── pages.controller.ts
├── pages.service.ts
├── pages.repository.ts
├── dto/
│   ├── create-page.dto.ts
│   ├── update-page.dto.ts
│   └── page-response.dto.ts
├── policies/
│   └── page-access.policy.ts
└── tests/
```

Service example:

```typescript
@Injectable()
export class PagesService {
  constructor(
    private readonly repository: PagesRepository,
    private readonly cache: PageCacheService,
  ) {}

  async update(
    userId: string,
    pageId: string,
    input: UpdatePageInput,
  ) {
    const page = await this.repository.findOwnedById(pageId, userId);

    if (!page) {
      throw new NotFoundException("Page not found");
    }

    const updated = await this.repository.update(pageId, input);

    await this.cache.invalidate(updated.slug);

    return updated;
  }
}
```

---

# 34. Repository Rules

Repository methods should express business-relevant queries.

Good:

```typescript
findOwnedById(pageId, userId)
```

Avoid:

```typescript
findById(pageId)
```

followed by authorization scattered throughout controllers.

---

# 35. Authorization

Every protected resource must use ownership checks.

Example:

```text
PATCH /blocks/:blockId
       ↓
authenticate
       ↓
load block
       ↓
load owning page
       ↓
verify page.userId === currentUser.id
       ↓
update
```

Never trust IDs supplied by the browser.

---

# 36. Frontend Routes

```text
/
 /login
 /register
 /forgot-password

/dashboard
/dashboard/links
/dashboard/appearance
/dashboard/analytics
/dashboard/settings

/[username]

/admin
/admin/users
/admin/pages
/admin/reports
```

---

# 37. Dashboard Component Tree

```text
DashboardLayout
├── Sidebar
├── Header
│   ├── SaveStatus
│   ├── PreviewButton
│   └── PublishButton
│
└── EditorWorkspace
    ├── BlockEditor
    │   ├── BlockList
    │   │   ├── LinkBlockEditor
    │   │   ├── TextBlockEditor
    │   │   ├── ImageBlockEditor
    │   │   └── ...
    │   └── AddBlockMenu
    │
    └── LivePreview
        └── PublicPageRenderer
```

---

# 38. Public Page Component Tree

```text
PublicPage
├── ProfileHeader
│   ├── Avatar
│   ├── DisplayName
│   └── Bio
│
├── SocialBar
│
├── BlockRenderer
│   ├── LinkBlock
│   ├── TextBlock
│   ├── ImageBlock
│   ├── VideoBlock
│   └── ...
│
└── BrandFooter
```

The renderer must map a known `BlockType` to a known React component. Never render arbitrary component names from user JSON.

---

# 39. Frontend State

### TanStack Query

Use for:

```text
page
blocks
themes
analytics
profile
media
```

### Zustand

Use for:

```text
selectedBlockId
previewMode
editorSidebar
unsavedChanges
devicePreview
```

Do not duplicate server state into Zustand.

---

# 40. Autosave

```text
User changes block
      ↓
Local state updates immediately
      ↓
Debounce 500 ms
      ↓
PATCH API
      ↓
Invalidate/update query cache
      ↓
SaveStatus = Saved
```

On failure:

```text
SaveStatus = Error
Retry
```

Use optimistic updates carefully and roll back on failed mutations.

---

# 41. Drag and Drop

Use `dnd-kit`.

```text
DndContext
 └── SortableContext
      ├── SortableBlock
      ├── SortableBlock
      └── SortableBlock
```

On drag end:

```text
calculate new order
      ↓
update local UI
      ↓
PATCH reorder
```

---

# 42. Public Rendering Strategy

Use Next.js Server Components for:

- Profile
- Theme
- Blocks
- SEO metadata

Client components only where interaction is required:

- click analytics
- share actions
- video controls
- interactive embeds

Avoid shipping editor/dashboard libraries to public pages.

---

# 43. Analytics Client

Create a very small browser analytics module:

```typescript
trackPageView(pageId);
trackLinkClick(pageId, blockId);
```

Send using:

```text
navigator.sendBeacon()
```

where appropriate, with `fetch(..., { keepalive: true })` as fallback.

Analytics failures must never break navigation.

---

# 44. SEO

Generate metadata from page data:

```typescript
export async function generateMetadata() {
  return {
    title: `${displayName} | kachko`,
    description: bio,
    openGraph: {
      title: displayName,
      description: bio,
      images: [avatarUrl],
    },
  };
}
```

Use canonical URLs.

---

# 45. Theme JSON

Example:

```json
{
  "background": {
    "type": "gradient",
    "value": "linear-gradient(135deg, #111827, #312e81)"
  },
  "typography": {
    "fontFamily": "Inter",
    "titleSize": 32
  },
  "buttons": {
    "variant": "glass",
    "radius": 18,
    "shadow": true
  },
  "cards": {
    "radius": 20,
    "blur": 12
  }
}
```

Sanitize theme fields before rendering CSS.

Never allow arbitrary CSS injection.

---

# 46. Security Headers

At the edge/app level configure:

```text
Strict-Transport-Security
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
```

CSP should be explicitly designed around required embeds rather than using an unnecessarily permissive policy.

---

# 47. Rate Limiting

Redis key format:

```text
rate:{route}:{identifier}
```

Examples:

```text
rate:login:ip
rate:register:ip
rate:analytics:user
rate:upload:user
```

Example policy:

```text
Login: 5/min/IP
Register: 3/hour/IP
Password reset: 5/hour/IP
Analytics: 120/min/user
Upload: 20/hour/user
```

Tune from telemetry.

---

# 48. Idempotency

For mutation endpoints where duplicate requests are possible, support:

```text
Idempotency-Key
```

especially for:

- media completion
- imports
- future payment operations

Store short-lived idempotency records in Redis.

---

# 49. Transactions

Use Prisma transactions for multi-row operations:

```text
publish page
reorder blocks
delete page
import page
```

Example:

```typescript
await prisma.$transaction(async (tx) => {
  await tx.page.update(...);
  await tx.pageBlock.updateMany(...);
  await tx.auditLog.create(...);
});
```

---

# 50. Database Migration Rules

Never edit production schema manually.

Workflow:

```text
schema.prisma
    ↓
prisma migrate dev
    ↓
migration committed to Git
    ↓
CI validation
    ↓
production migration
```

Backup before risky production migrations.

---

# 51. Seed Data

Seed:

- reserved usernames
- system themes
- default templates
- initial feature flags

Example:

```text
Minimal Light
Minimal Dark
Gradient
Glass
Creator
Developer
Portfolio
Business
```

---

# 52. Template Model

A template can be represented as configuration:

```typescript
interface TemplateDefinition {
  slug: string;
  theme: ThemeDefinition;
  blocks: BlockDefinition[];
}
```

Applying a template:

```text
Template
 ↓
create page
 ↓
create theme assignment
 ↓
create blocks
```

Templates should not require custom application code.

---

# 53. Admin APIs

```text
GET    /admin/users
POST   /admin/users/:id/suspend

GET    /admin/pages
POST   /admin/pages/:id/unpublish

GET    /admin/reports
PATCH  /admin/reports/:id

GET    /admin/system/health
```

Protect using role guard:

```typescript
@Roles(UserRole.ADMIN)
```

---

# 54. Moderation Flow

```text
Public user
   ↓
Report Page
   ↓
Report stored
   ↓
Moderator queue
   ↓
Review
   ├── reject
   ├── warn
   ├── unpublish
   └── suspend account
```

Add automated URL reputation scanning as a later enhancement.

---

# 55. Error Handling

Global NestJS exception filter maps exceptions to stable API errors.

Example:

```json
{
  "success": false,
  "error": {
    "code": "USERNAME_TAKEN",
    "message": "Username is already in use"
  }
}
```

Frontend should branch on stable `code`, not message text.

---

# 56. Error Code Catalog

```text
AUTH_INVALID_CREDENTIALS
AUTH_SESSION_EXPIRED
AUTH_UNAUTHORIZED

USER_NOT_FOUND
USER_USERNAME_TAKEN
USER_USERNAME_INVALID

PAGE_NOT_FOUND
PAGE_ACCESS_DENIED
PAGE_SLUG_TAKEN

BLOCK_NOT_FOUND
BLOCK_INVALID_TYPE
BLOCK_INVALID_CONTENT

MEDIA_NOT_FOUND
MEDIA_TOO_LARGE
MEDIA_INVALID_TYPE

RATE_LIMIT_EXCEEDED

REPORT_NOT_FOUND
FORBIDDEN

INTERNAL_ERROR
```

---

# 57. Pagination

Use cursor pagination for growing collections.

Example:

```text
GET /pages/:pageId/analytics/events?limit=50&cursor=abc
```

Response:

```json
{
  "items": [],
  "nextCursor": "def"
}
```

Do not return unbounded analytics datasets.

---

# 58. API Security Checklist

```text
[ ] Authentication middleware
[ ] Authorization checks
[ ] DTO/schema validation
[ ] Rate limiting
[ ] CORS allowlist
[ ] Security headers
[ ] Request body limits
[ ] Safe URL validation
[ ] SQL injection protection via Prisma
[ ] Output filtering
[ ] Audit logs
[ ] Session revocation
[ ] Password hashing
[ ] Secret management
```

---

# 59. Docker Compose — Local Development

Services:

```text
postgres
redis
api
web
```

Example environment:

```text
DATABASE_URL=postgresql://kachko:kachko@postgres:5432/kachko
REDIS_URL=redis://redis:6379
```

R2 can be mocked locally or replaced by an S3-compatible development service.

---

# 60. API Docker Runtime

Use a multi-stage build:

```text
Node build image
      ↓
install dependencies
      ↓
generate Prisma client
      ↓
build NestJS
      ↓
minimal Node runtime image
```

Run as a non-root user.

Expose only the application port.

---

# 61. Web Deployment

Vercel:

```text
main
 ↓
Vercel build
 ↓
Next.js deployment
```

Set:

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_CDN_URL
```

Only variables prefixed with `NEXT_PUBLIC_` should be treated as intentionally browser-visible.

---

# 62. API Deployment

Azure Container Apps:

```text
GitHub
 ↓
GitHub Actions
 ↓
Docker build
 ↓
Container Registry
 ↓
Azure Container Apps
```

Configure:

- minimum replicas based on budget
- autoscaling
- health probes
- secrets
- HTTPS ingress
- revision-based deployments

---

# 63. API Health Endpoints

```text
GET /health
GET /health/live
GET /health/ready
```

### Liveness

Checks process health.

### Readiness

Checks required dependencies such as PostgreSQL/Redis as appropriate.

Do not make liveness fail merely because an external dependency is temporarily unavailable.

---

# 64. Environment Variables

### Web

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_CDN_URL
SENTRY_DSN
```

### API

```text
NODE_ENV
PORT
DATABASE_URL
REDIS_URL

SESSION_SECRET

R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_PUBLIC_URL

CORS_ORIGINS
SENTRY_DSN
```

Secrets must never be committed to Git.

---

# 65. CI Pipeline

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  validate:
    steps:
      - checkout
      - setup-node
      - pnpm install
      - pnpm lint
      - pnpm typecheck
      - pnpm test
      - pnpm build
```

Production deployment should be a separate controlled workflow.

---

# 66. Testing Strategy

## Unit

Test:

- username rules
- URL validation
- block validation
- PageService
- BlockService
- analytics aggregation
- authorization policies

## Integration

Test against PostgreSQL/Redis:

- authentication
- page CRUD
- block CRUD
- reorder transaction
- publish/unpublish
- analytics ingestion

## E2E

Playwright journey:

```text
Register
 ↓
Create username
 ↓
Create page
 ↓
Add link
 ↓
Choose theme
 ↓
Publish
 ↓
Open public URL
 ↓
Click link
 ↓
Open analytics
```

---

# 67. Testing Rules

Minimum expectations before production:

```text
Critical business services: high unit coverage
Authentication: integration + E2E
Authorization: integration
Public page: E2E
Publishing: E2E
Analytics: integration
Media upload: integration
```

Do not chase an arbitrary 100% coverage number.

---

# 68. Performance Design

### Public page

- SSR/ISR
- CDN
- Redis
- optimized images
- no editor JS
- minimal third-party scripts

### Dashboard

- code splitting
- lazy-load heavy editor panels
- virtualize very large lists if required
- debounce autosave
- optimistic updates

### API

- select only required DB fields
- avoid N+1 queries
- use indexes
- cache public pages

---

# 69. N+1 Prevention

Public page should load in a bounded number of DB queries.

Preferred:

```typescript
prisma.page.findUnique({
  where: { slug },
  include: {
    blocks: { orderBy: { position: "asc" } },
    socials: { orderBy: { position: "asc" } },
    theme: true,
  },
});
```

Select only required fields in production.

---

# 70. Cache Invalidation

After:

```text
page update
block create/update/delete
block reorder
social update
theme update
profile update
```

invalidate:

```text
page:{username}
```

If a user changes username:

```text
invalidate old page key
invalidate new page key
```

Also update canonical URLs.

---

# 71. Data Retention

Recommended initial policies:

```text
Analytics: 12 months
Audit logs: 12–24 months
Expired sessions: cleanup daily
Soft-deleted user data: defined deletion window
Temporary import jobs: short TTL
```

These are product/legal decisions and should be reviewed against applicable privacy laws and policies.

---

# 72. Account Deletion

Flow:

```text
User requests deletion
 ↓
confirm
 ↓
soft-delete user
 ↓
unpublish pages
 ↓
revoke sessions
 ↓
schedule media deletion
 ↓
schedule hard deletion according to retention policy
```

Analytics should be anonymized/deleted as required.

---

# 73. Public Link Click Tracking

Do not force users through an application redirect unless required.

Preferred:

```text
<a href="https://youtube.com/..." ...>
```

with client-side analytics.

If later server-side click tracking is required:

```text
/r/:blockId
```

must be carefully designed for:

- open redirect prevention
- caching
- latency
- privacy
- abuse

---

# 74. SEO Safety

User-generated metadata must be escaped by the framework.

Do not allow arbitrary:

```text
<script>
<style>
```

content in blocks.

Rich text, if added later, must use a strict sanitizer.

---

# 75. Accessibility

Target WCAG 2.2 AA.

Required:

- keyboard navigation
- focus visibility
- semantic HTML
- labels
- screen-reader support
- sufficient contrast
- reduced-motion support
- accessible drag/drop alternatives

Drag-and-drop must not be the only way to reorder blocks.

---

# 76. Mobile UX

Public page:

```text
100% responsive
```

Editor:

```text
Desktop:
sidebar + editor + preview

Mobile:
editor
+
bottom sheet/preview
```

The page preview should support:

```text
Mobile
Tablet
Desktop
```

---

# 77. V1 Block Renderer Contract

```typescript
type BlockRendererProps<T> = {
  block: {
    id: string;
    type: BlockType;
    content: T;
  };
  mode: "public" | "preview";
};
```

Map:

```typescript
const renderers = {
  LINK: LinkBlock,
  TEXT: TextBlock,
  IMAGE: ImageBlock,
  VIDEO: VideoBlock,
  SOCIAL: SocialBlock,
  DIVIDER: DividerBlock,
  YOUTUBE: YouTubeBlock,
  SPOTIFY: SpotifyBlock,
  EMAIL: EmailBlock,
  PHONE: PhoneBlock,
  LOCATION: LocationBlock,
};
```

Unknown types should fail safely rather than rendering arbitrary content.

---

# 78. Link Click Event Flow

```text
User clicks link
       ↓
trackLinkClick()
       ↓
navigator.sendBeacon()
       ↓
POST /analytics/events
       ↓
validate page/block relationship
       ↓
persist event
```

Navigation should proceed regardless of analytics success.

---

# 79. Page Publish Flow

```text
User clicks Publish
       ↓
authenticate
       ↓
verify ownership
       ↓
validate page
       ↓
validate visible blocks
       ↓
DB transaction
       ├── isPublished=true
       ├── publishedAt
       └── audit log
       ↓
invalidate cache
       ↓
return public URL
```

Publishing should not allow invalid/unsafe block content.

---

# 80. Unpublish Flow

```text
authenticate
 ↓
verify ownership
 ↓
update isPublished=false
 ↓
invalidate cache
 ↓
audit
```

Public route should return a proper 404/not-found result for unpublished pages.

---

# 81. Link Validation

At creation/update:

```text
trim
 ↓
parse URL
 ↓
validate protocol
 ↓
normalize where safe
 ↓
persist
```

Optional future enhancement:

```text
URL reputation service
```

---

# 82. Abuse Protection

Minimum:

- registration rate limit
- login rate limit
- upload limits
- analytics limits
- report system
- unsafe URL validation
- moderation controls
- page suspension
- account suspension

Future:

- malware scanning
- phishing reputation
- bot detection
- automated content classification

---

# 83. Logging Policy

Structured logs:

```typescript
logger.info({
  action: "PAGE_PUBLISHED",
  userId,
  pageId,
});
```

Never log:

```text
password
session token
authorization header
R2 secret
raw sensitive user data
```

Use correlation/request IDs.

---

# 84. Monitoring Dashboards

Track at least:

```text
API request rate
API error rate
API P50/P95/P99
DB CPU/connections/latency
Redis hit/miss
Public page cache hit ratio
Page render latency
Upload failures
Analytics ingestion failures
5xx rate
Authentication failures
```

Set alerts on sustained degradation rather than individual noisy events.

---

# 85. Database Index Plan

Required initial indexes:

```text
users.username
users.email
pages.user_id
pages.slug
page_blocks(page_id, position)
page_blocks(page_id, is_visible, position)
social_profiles(page_id, position)
media(user_id, created_at)
analytics_events(page_id, created_at)
analytics_events(page_id, event_type, created_at)
audit_logs(user_id, created_at)
reports(status, created_at)
```

Measure query plans before adding more indexes.

---

# 86. Database Constraints

Use DB constraints for invariants:

```text
users.email UNIQUE
users.username UNIQUE
pages.slug UNIQUE
domains.domain UNIQUE
media.storage_key UNIQUE
sessions.token_hash UNIQUE
```

Application validation improves UX; DB constraints provide final consistency.

---

# 87. API Versioning Strategy

Current:

```text
/api/v1
```

Breaking changes:

```text
/api/v2
```

Non-breaking changes should remain within v1.

Document deprecation dates before removing API behavior.

---

# 88. OpenAPI

Generate OpenAPI from NestJS decorators/schema definitions.

Expose Swagger only as appropriate for the environment.

Recommended:

```text
Development: enabled
Staging: protected
Production: protected or disabled
```

OpenAPI becomes the contract between frontend/backend teams.

---

# 89. Frontend API Client

Create one typed API layer:

```text
lib/api/
├── client.ts
├── auth.ts
├── pages.ts
├── blocks.ts
├── themes.ts
├── analytics.ts
└── media.ts
```

Components should not repeatedly construct raw fetch URLs.

---

# 90. Shared Types

`packages/types`:

```text
User
Page
PageBlock
BlockType
Theme
SocialProfile
Analytics
```

`packages/validation`:

```text
CreatePageSchema
UpdatePageSchema
CreateBlockSchema
UpdateBlockSchema
```

Avoid sharing server-only types into browser bundles if they include secrets/internal fields.

---

# 91. Feature Development Order

## Phase 0 — Repository

```text
Turborepo
pnpm
Next.js
NestJS
Prisma
Docker Compose
ESLint
Prettier
CI
```

## Phase 1 — Identity

```text
User
Session
Register
Login
Logout
Username
```

## Phase 2 — Page Core

```text
Page CRUD
Publish
Public page
Profile
```

## Phase 3 — Blocks

```text
LINK
TEXT
IMAGE
SOCIAL
DIVIDER
```

## Phase 4 — Editor

```text
Drag/drop
Live preview
Autosave
Responsive preview
```

## Phase 5 — Appearance

```text
Themes
Templates
Fonts
Buttons
Backgrounds
```

## Phase 6 — Media

```text
R2
Upload
Image optimization
Avatar
```

## Phase 7 — Analytics

```text
Views
Clicks
CTR
Devices
Countries
Referrers
```

## Phase 8 — Growth

```text
QR
SEO
Share
Import
```

## Phase 9 — Production Hardening

```text
Security
Rate limiting
Moderation
Backups
Monitoring
Load testing
```

---

# 92. Suggested Git Strategy

Branches:

```text
main
develop
feature/*
fix/*
hotfix/*
```

PR requirements:

```text
lint
typecheck
tests
build
review
```

Commit examples:

```text
feat(auth): add email registration
feat(page): add page publishing
feat(editor): add sortable blocks
feat(analytics): add page view tracking
fix(cache): invalidate public page after block update
```

---

# 93. Definition of Done

A feature is not done until:

```text
[ ] TypeScript compiles
[ ] Input validated
[ ] Authorization implemented
[ ] Error codes documented
[ ] Unit tests added
[ ] Integration test if DB behavior changed
[ ] API documented
[ ] UI responsive
[ ] Accessibility checked
[ ] Logging added where useful
[ ] Cache invalidation considered
[ ] Security impact reviewed
```

---

# 94. V1 Acceptance Criteria

A new user must be able to:

1. Register.
2. Select an available username.
3. Create a profile.
4. Add links.
5. Add social profiles.
6. Reorder content.
7. Select a theme.
8. Upload an avatar/image.
9. Preview the page.
10. Publish the page.
11. Open the public URL.
12. Share the URL.
13. Generate a QR code.
14. See page views.
15. See link clicks.
16. See basic CTR.
17. Unpublish the page.
18. Delete their account.

---

# 95. Launch Readiness Checklist

## Product

```text
[ ] onboarding
[ ] editor
[ ] templates
[ ] public page
[ ] analytics
[ ] QR
[ ] sharing
```

## Engineering

```text
[ ] CI/CD
[ ] database backup
[ ] monitoring
[ ] error tracking
[ ] rate limiting
[ ] security headers
[ ] dependency scanning
[ ] load testing
```

## Security

```text
[ ] authentication
[ ] authorization
[ ] session revocation
[ ] URL validation
[ ] upload validation
[ ] CSP
[ ] HSTS
[ ] CORS
```

## Operations

```text
[ ] rollback procedure
[ ] database restore procedure
[ ] incident contacts
[ ] environment documentation
[ ] runbook
```

---

# 96. Recommended First Production Topology

```text
                         USERS
                           │
                           ▼
                     ┌───────────┐
                     │ Cloudflare│
                     │ CDN/WAF   │
                     └─────┬─────┘
                           │
                ┌──────────┴───────────┐
                │                      │
                ▼                      ▼
          ┌───────────┐        ┌──────────────┐
          │  Vercel   │        │ Azure ACA    │
          │ Next.js   │───────▶│ NestJS API   │
          └───────────┘        └──────┬───────┘
                                      │
                         ┌────────────┼────────────┐
                         │            │            │
                         ▼            ▼            ▼
                    PostgreSQL     Redis       Cloudflare R2
                         │
                         ▼
                    Backups/PITR
```

---

# 97. Architectural Guardrails

Do not:

- put business logic in React components
- access Prisma from controllers
- store passwords in plaintext
- store session tokens directly
- store media blobs in PostgreSQL
- trust client-provided ownership
- render arbitrary component names from JSON
- accept arbitrary URL schemes
- expose secrets through `NEXT_PUBLIC_*`
- make analytics failure block link navigation
- introduce microservices before there is a real scaling/team reason
- introduce Kubernetes just because the product is "production"

---

# 98. Future Scale Migration

When traffic becomes large:

```text
Current
PostgreSQL analytics
        ↓
Scale pressure
        ↓
Queue
        ↓
ClickHouse
```

When API traffic grows:

```text
1–N NestJS containers
        ↓
autoscaling
```

When public pages become massive:

```text
Next.js
 ↓
CDN
 ↓
edge/cache
```

When engineering organization grows:

```text
Modular monolith
 ↓
extract analytics
 ↓
extract media
 ↓
extract notifications
```

Only extract modules when operational or organizational boundaries justify it.

---

# 99. Final Engineering Recommendation

Build V1 as a **TypeScript modular monolith** with:

```text
Next.js
+
NestJS
+
Prisma
+
PostgreSQL
+
Redis
+
Cloudflare R2
+
Cloudflare
+
Vercel
+
Azure Container Apps
```

The most important design decision is:

```text
User
 ↓
Page
 ↓
Composable Blocks
 ↓
Theme
```

Everything else should be built around this model.

This gives the product a simple V1 while keeping the architecture capable of growing into a broader creator/personal-page platform.
