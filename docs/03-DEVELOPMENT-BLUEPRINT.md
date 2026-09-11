# kachko — Development Blueprint

> **Purpose:** A step-by-step implementation plan for building kachko, a modern free Linktree-style personal landing-page platform.
>
> **Primary stack:** TypeScript, Next.js App Router, React, Tailwind CSS, shadcn/ui, NestJS, Prisma, PostgreSQL, Redis, Cloudflare R2, Turborepo, pnpm, Docker.
>
> **Development principle:** Build the smallest production-quality vertical slice first. Do not build advanced infrastructure before the product needs it.

---

## START HERE — Rohan (BE) and Girish (FE)

**Rohan owns backend (BE), database, infrastructure, and API contracts. Girish owns all frontend (FE) work.** Both review contracts and verify integrated features. Follow the execution order in [section 71](#71-exact-development-order); the numbered phases below are technical references, not a requirement to finish all backend work before frontend starts.

### Step-by-step execution flow

**Start now:** Rohan verifies the NestJS API and sets up PostgreSQL/Redis + Prisma. At the same time, Girish verifies the existing Next.js app and builds UI primitives plus auth/dashboard shells.

Complete the following steps in order. The Rohan and Girish columns show the tasks each person takes; the dependency column shows what must be ready first. Girish can build contract-backed UI with fixtures while Rohan implements the matching API. A step is complete only after both verify it using the real API.

| Step | Complete first / dependencies | Rohan — backend and infrastructure | Girish — frontend | Completion gate (both) |
|---|---|---|---|---|
| 1. Verify foundation | Existing repository | Verify Nest scaffold; complete workspace scripts/CI, local PostgreSQL + Redis, env examples | Verify existing Next app; add FE typecheck/testing scripts, UI primitives, responsive dashboard/auth shells | Both apps run locally; relevant lint, typecheck, build and initial checks pass |
| 2. Identity contract + data | Step 1 | Shared DTOs/errors, User/Session schema and migration; settle username and cookie/CSRF flow, seed reserved names | Typed API client, contract fixtures, registration/login/username forms | Contract reviewed; migration works on an empty DB; FE can render all form states |
| 3. Identity integration | Step 2 | Register/login/logout/current user, username checks, profile update, session expiry/revocation, auth rate limits | Connect auth/profile UI, protected dashboard, session expiry handling | Register with username, log in, reload session, edit profile and log out against API; ownership/session tests pass |
| 4. First publishable page | Step 3; page/block/public DTOs agreed | Page CRUD, LINK CRUD, safe URLs, ownership, default theme, publish/unpublish, public lookup and cache invalidation | Basic dashboard, profile fields, add/edit/delete link, publish controls, SSR public renderer | Register → page → link → publish → public URL works; unpublished pages return 404 and private data stays private |
| 5. Editor | Step 4 | TEXT block validation; visibility/reorder transaction; reliable updates and failure responses | Text editor, drag/drop plus manual reorder, live preview, autosave/retry/rollback, mobile editor | Edits and order survive reload; failed saves are visible and preserve edits; hidden blocks stay hidden |
| 6. Appearance + social | Step 5 | Theme catalog/config validation and persistence, templates, social CRUD/reorder | Theme/template picker, appearance controls, social editor/icons, matching preview/public rendering | Theme/social changes persist and appear correctly on public page |
| 7. Media + IMAGE blocks | Step 4; media contract agreed; can overlap steps 5–6 | R2 upload authorization/completion, actual-file checks, ownership, metadata/delete, IMAGE block validation | Upload/progress/retry UI, avatar picker, image editor and optimized public rendering | Upload → complete → attach → publish works; invalid/foreign uploads rejected. IMAGE is not complete before this gate |
| 8. Basic analytics | Steps 4 and 6 for social events | Event ingestion/limits, page-block checks, aggregation/date ranges, retention | Nonblocking view/link/social tracking; analytics cards, charts and empty/error states | Real visits/clicks populate correct owner-only totals; tracking failure never blocks navigation |
| 9. Share + SEO + QR | Step 4; can overlap steps 7–8 | QR API from canonical public URL; safe public metadata fields | QR download, copy/share, metadata/canonical/OG, missing-page UX | Shared URL and QR open correct page; metadata reflects current profile |
| 10. Launch protections | Identity/page foundation; develop alongside features | Password reset, reports, role-protected moderation, audit logs, account/data deletion and cleanup | Reset-password flow, report form, minimal moderation UI, account deletion confirmation/status | Abuse can be handled; deleted/suspended accounts lose sessions and public visibility; critical security tests pass |
| 11. Staging and release | Steps 1–10 integrated | API container/deploy, migrations, secrets, readiness, monitoring, backups/restore, rollback, load checks | Vercel/env setup, browser error tracking, accessibility/mobile/performance checks, Playwright journey | Both verify staging journey, cookie/CORS behavior, restore/rollback and production checklist before release |

### Rohan — BE work sequence

Foundation and local services → identity schema/contracts → auth/profile APIs → page/link/publish/public APIs → editor support → themes/social APIs → media/IMAGE APIs → analytics → QR → launch protections → staging/release.

### Girish — FE work sequence

Next.js and UI foundations → typed client and auth fixtures → auth/profile integration → basic dashboard/link editor/public page → full editor → themes/social UI → uploads/IMAGE UI → analytics dashboard → share/SEO/QR → reset/report/deletion UI → staging/E2E/release.

**Parallel work:** media can begin after step 4 once its contract is agreed; share/SEO/QR can also begin after step 4. Security and tests are part of every feature. The first joint milestone is **Register → Create page → Add link → Publish → Open public URL** (step 4).

Quick links: [detailed execution rules](#71-exact-development-order), [task board](#84-suggested-task-board), [weekly plan](#86-recommended-weekly-development-plan), [first 10 actions](#87-the-first-10-development-actions).

### Ownership

| Area | Owner | Responsibility |
|---|---|---|
| `apps/api` | Rohan — BE | NestJS modules, authentication, authorization, validation, APIs, API tests |
| `prisma`, local services, deployment infrastructure | Rohan — BE | Schema, migrations, seeds, PostgreSQL, Redis, R2, API hosting, backups |
| `apps/kachko-fe` and `packages/ui` | Girish — FE | Next.js, all screens, editor, public renderer, client integration, accessibility, frontend tests, Vercel setup |
| `packages/types` and `packages/validation` | Rohan leads; Girish reviews | Public DTOs and shared schemas before each feature starts; no Prisma/private types in browser bundles |
| Root workspace, lockfile, CI, shared tooling | Rohan leads; Girish contributes FE scripts | Coordinate overlapping edits and regenerate the lockfile through pnpm |
| Integration, E2E, release checks | Both | Girish leads browser journeys; Rohan supplies APIs/test fixtures and fixes server failures |

### Repository baseline

The repository and pnpm/Turborepo workspace already exist. Continue frontend development in the existing `apps/kachko-fe` application. The API originally contained Express dependencies and a generic TypeScript configuration, with no application source. It now has a NestJS scaffold, versioned health routes, environment validation, request validation, CORS, security headers, error handling, and development OpenAPI docs. Database connections and business features remain to be implemented. Existing files are not proof that every foundation check passes.

### Working agreement and handoff

1. Rohan publishes a feature contract: method/path, request/response examples, validation rules, error codes, auth requirements, and acceptance cases. Girish reviews it before building API-dependent UI.
2. Girish builds against fixtures matching that contract while Rohan implements the API. UI shells can start immediately; real integration waits for the corresponding API.
3. Rohan hands over a working endpoint, migrations/seeds if needed, OpenAPI updates, and passing API checks. Girish replaces fixtures and verifies success, loading, empty, error, and expired-session behavior.
4. Both verify the completion gate in section 71. Mocked UI alone does not complete a feature.
5. Use separate branches such as `feature/be-auth` and `feature/fe-auth`. Keep contract changes in small reviewed PRs; update both callers and server for breaking changes.

### Resolve documentation differences before integration

For this project, use the following blueprint conventions when examples in the LLD differ. Record them in shared contracts and OpenAPI as endpoints are implemented:

- All business endpoints use `/api/v1`. Public lookup is `GET /api/v1/public/:username`.
- Use the nested block paths and `POST .../blocks/reorder` from section 23, rather than the alternate LLD paths/methods.
- Use section 18 envelopes consistently, including wrapping the current-user response in `data`. `GET /auth/me` checks the session/current identity; `GET /users/me` reads the editable profile (both under `/api/v1`).
- Choose username before submitting registration, so the LLD's required unique `User.username` can be stored immediately. The UI may collect it as a separate step before submitting the combined registration request. For V1, the single page slug follows the username; username changes update it transactionally and invalidate old/new public URLs.
- `LINK` URLs allow HTTP(S). Add `mailto:`/`tel:` only with their dedicated validated block types later.
- Shared block packages contain data/types/validation. React editors and renderers stay in the frontend registry.
- Social profiles, account deletion, and basic abuse reporting/moderation are launch requirements, consistent with the LLD acceptance/security requirements. OAuth, imports, advanced embeds/analytics, and a richer admin dashboard follow the core release.

---

## 1. Product Goal

Build a user-friendly platform where a user can:

1. Create an account.
2. Choose a username.
3. Create a public profile page.
4. Add links and social profiles.
5. Customize appearance.
6. Publish the page.
7. Share `kachko.app/<username>`.
8. See basic page/link analytics.
9. Generate a QR code.
10. Upload profile/media images.

### V1 should feel like

- Fast
- Clean
- Mobile-first
- Easy for non-technical users
- Visually polished
- Safe by default
- Free for the core experience

### Do NOT start with

- Microservices
- Kubernetes
- Payment subscriptions
- Complex teams/organizations
- Marketplace
- Full e-commerce
- Event streaming infrastructure
- ClickHouse
- Custom domains as a launch blocker
- Mobile apps

Start with a modular monolith.

---

# 2. Target Architecture

```text
                         INTERNET
                            |
                            v
                  +-------------------+
                  | Cloudflare        |
                  | DNS/CDN/WAF/TLS   |
                  +---------+---------+
                            |
                 +----------+----------+
                 |                     |
                 v                     v
          +-------------+       +-------------+
          | Next.js     |       | NestJS API  |
          | Vercel      |       | Azure ACA   |
          +------+------+       +------+------+
                 |                     |
                 |                     |
                 +----------+----------+
                            |
              +-------------+-------------+
              |             |             |
              v             v             v
        +-----------+ +-----------+ +-----------+
        | PostgreSQL| |   Redis   | | Cloudflare|
        | Source of | | Cache +   | | R2 Media  |
        | truth     | | limits    | | Storage   |
        +-----------+ +-----------+ +-----------+
```

### Responsibilities

| Component | Responsibility |
|---|---|
| Next.js | UI, dashboard, editor, public profile rendering |
| NestJS | Authentication, business rules, APIs, authorization |
| PostgreSQL | Persistent application data |
| Prisma | Database access and migrations |
| Redis | Cache, rate limiting, short-lived data |
| R2 | Images/media |
| Cloudflare | DNS, CDN, WAF, TLS |
| Vercel | Next.js hosting |
| Azure Container Apps | API hosting |

---

# 3. Development Rules

Follow these rules throughout development.

### Rule 1 — TypeScript everywhere

Avoid JavaScript except where a configuration/tool requires it.

### Rule 2 — Validate at boundaries

Use Zod/class-validator at API boundaries.

### Rule 3 — Never trust the frontend

Every ownership and permission check happens in the backend.

### Rule 4 — PostgreSQL is the source of truth

Redis is disposable.

### Rule 5 — Public pages are performance-critical

Optimize public rendering before adding unnecessary dashboard optimizations.

### Rule 6 — Keep blocks extensible

A link block should not require redesigning the database when adding a new block type.

### Rule 7 — No secrets in the browser

Only expose explicitly public `NEXT_PUBLIC_*` values.

### Rule 8 — Every feature has tests

At minimum:

- Unit test for business logic.
- Integration test for important API behavior.
- E2E test for user-critical flows.

---

# 4. Development Environment

Recommended baseline:

```text
Node.js       Current active LTS
pnpm          Current stable pnpm
Git           Current stable
Docker        Docker Desktop
PostgreSQL    16+
Redis         7+
VS Code       Recommended
```

Verify:

```bash
node -v
pnpm -v
git --version
docker --version
docker compose version
```

Enable Corepack if required:

```bash
corepack enable
```

After selecting the pnpm version for the project, pin it in `package.json`:

```json
{
  "packageManager": "pnpm@<approved-version>"
}
```

Do not use an unpinned package manager version in CI.

---

# 5. Phase 0 — Create the Repository

## Step 0.1 — Create project

```bash
mkdir kachko
cd kachko
git init
```

Create the initial branch:

```bash
git checkout -b main
```

Recommended development branch:

```bash
git checkout -b develop
```

Feature branches:

```text
feature/auth
feature/page-editor
feature/public-profile
feature/analytics
```

---

# 6. Phase 1 — Monorepo Setup

## Step 1.1 — Create workspace

Recommended structure:

```text
kachko/
├── apps/
│   ├── kachko-fe/
│   └── api/
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
│   ├── scripts/
│   └── terraform/
│
├── docs/
│
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

Create workspace:

```yaml
# pnpm-workspace.yaml

packages:
  - "apps/*"
  - "packages/*"
```

---

## Step 1.2 — Root package

Root scripts should eventually look similar to:

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "test:e2e": "turbo test:e2e",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed"
  }
}
```

---

# 7. Phase 2 — Create Next.js Application

Create:

```text
apps/kachko-fe
```

Use:

- TypeScript
- App Router
- Tailwind
- ESLint
- React Server Components
- Strict TypeScript

Target structure:

```text
apps/kachko-fe/
├── app/
│   ├── (marketing)/
│   ├── (auth)/
│   ├── dashboard/
│   ├── [username]/
│   ├── admin/
│   ├── layout.tsx
│   └── globals.css
│
├── components/
├── features/
│   ├── editor/
│   ├── links/
│   ├── profile/
│   ├── appearance/
│   └── analytics/
│
├── hooks/
├── lib/
├── public/
└── middleware.ts
```

### Important

Use Server Components for:

```text
/[username]
```

Use Client Components only where interaction is required:

- drag/drop
- editor controls
- forms requiring client state
- analytics event dispatch
- interactive embeds

---

# 8. Phase 3 — Create NestJS API

Create:

```text
apps/api
```

Initial module layout:

```text
apps/api/src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── pages/
│   ├── blocks/
│   ├── themes/
│   ├── social/
│   ├── media/
│   ├── analytics/
│   ├── qr/
│   ├── imports/
│   ├── moderation/
│   ├── admin/
│   └── health/
│
├── common/
├── config/
├── database/
├── app.module.ts
└── main.ts
```

Each business module should follow:

```text
module/
├── module.ts
├── controller.ts
├── service.ts
├── repository.ts
├── dto/
├── schemas/
├── types/
└── tests/
```

Do not create all modules fully on day one. Create folders/modules as the feature is implemented.

---

# 9. Phase 4 — Local Infrastructure

The root `docker-compose.yml` now defines local PostgreSQL 16 and Redis 7, loopback-only ports, health checks, and named volumes. Follow the [local setup guide](../README.md#local-postgresql-and-redis). Environment examples are in root `.env.example` and `apps/api/.env.example`. API connections, dependency readiness, and Prisma remain separate next steps.

Services:

```text
postgres
redis
```

Initially do NOT containerize everything.

During local development:

```text
Next.js → localhost
NestJS  → localhost
Postgres → Docker
Redis    → Docker
```

This makes frontend/backend debugging easier.

Example local ports:

```text
Web       3000
API       4000
Postgres  5432
Redis     6379
```

Start infrastructure:

```bash
docker compose up -d postgres redis
```

Verify:

```bash
docker compose ps
```

Stop:

```bash
docker compose down
```

---

# 10. Phase 5 — Environment Configuration

Create:

```text
.env.example
```

Example:

```env
NODE_ENV=development

DATABASE_URL=postgresql://kachko:kachko@localhost:5432/kachko

REDIS_URL=redis://localhost:6379

API_URL=http://localhost:4000
WEB_URL=http://localhost:3000

SESSION_COOKIE_NAME=kachko_session

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=

SENTRY_DSN=
```

Never commit:

```text
.env
.env.local
.env.production
private keys
API secrets
database credentials
R2 secret keys
```

---

# 11. Phase 6 — Database First

Create Prisma:

```text
prisma/schema.prisma
```

Add models incrementally as their feature is implemented. Start with User, Session, Page, PageBlock and Theme for the first slice. The eventual model catalog includes:

```text
User
Session
Page
PageBlock
Theme
SocialProfile
Media
AnalyticsEvent
Domain
AuditLog
Report
FeatureFlag
```

---

# 12. Initial Prisma Model Strategy

## User

Responsibilities:

- Account identity
- Login email
- Username
- Profile information
- Role/status

Important constraints:

```text
email       UNIQUE
username    UNIQUE
```

Username should be normalized to lowercase.

---

## Session

Use opaque random session tokens.

Database stores:

```text
tokenHash
```

Never store the raw session token.

Fields:

```text
id
userId
tokenHash
expiresAt
lastUsedAt
revokedAt
ipHash
userAgent
createdAt
```

---

## Page

A user can eventually have multiple pages.

V1 can initially expose one page in the UI.

Fields:

```text
id
userId
slug
title
description
isPublished
publishedAt
themeId
createdAt
updatedAt
```

Constraint:

```text
slug UNIQUE
```

---

# 13. Page Blocks

Do not create separate tables for every block type in V1.

Use:

```text
PageBlock
```

with:

```text
type
position
isVisible
content JSON
```

Supported initial types:

```text
LINK
TEXT
IMAGE
SOCIAL
DIVIDER
YOUTUBE
SPOTIFY
EMAIL
PHONE
LOCATION
```

Initial implementation should only require:

```text
LINK
TEXT
IMAGE
SOCIAL
```

Add the others later.

---

# 14. Block Content Contracts

Create shared TypeScript types.

Example:

```ts
export interface LinkBlockContent {
  title: string;
  url: string;
  icon?: string;
  thumbnailMediaId?: string;
  openInNewTab?: boolean;
}

export interface TextBlockContent {
  text: string;
  alignment: "left" | "center" | "right";
}

export interface ImageBlockContent {
  mediaId: string;
  alt: string;
  href?: string;
}
```

Create a block registry:

```text
packages/types/src/blocks.ts
```

The frontend registry should map shared block types to UI components (keep React imports out of `packages/types`):

```text
block type
→ validation schema
→ editor component
→ public renderer
→ default configuration
```

This is the key architectural decision that makes future block types easy to add.

---

# 15. Username Rules

Username requirements:

```text
Length: 3–30
Lowercase
Allowed:
a-z
0-9
_
-
.
```

Examples:

```text
rohan
rohan_dev
rohan-dev
rohan.dev
```

Reject:

```text
admin
administrator
api
login
signup
dashboard
settings
support
help
privacy
terms
about
```

Keep a reserved username list.

Username validation must happen:

1. Frontend
2. API
3. Database unique constraint

Frontend validation is for UX.

Backend/database validation is for correctness.

---

# 16. Phase 7 — Database Migration

Once the initial schema is ready:

```bash
pnpm prisma generate
```

Then:

```bash
pnpm prisma migrate dev --name init
```

Seed system themes:

```bash
pnpm db:seed
```

Check database:

```bash
pnpm prisma studio
```

Do not manually modify production database tables.

All production schema changes go through migrations.

---

# 17. Phase 8 — API Foundation

The NestJS scaffold implements part of this foundation. Complete request IDs, structured logging, and dependency readiness when local services are connected; verify the full checklist before business integration:

```text
Global validation
Global exception handling
Logging
Configuration
CORS
Swagger/OpenAPI
Health checks
Request IDs
Security headers
```

API base path:

```text
/api/v1
```

Examples:

```text
GET  /api/v1/health
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/users/me
GET  /api/v1/pages
```

---

# 18. API Response Convention

Success:

```json
{
  "data": {}
}
```

List:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

Error:

```json
{
  "error": {
    "code": "USERNAME_TAKEN",
    "message": "Username is already taken"
  }
}
```

Do not expose internal stack traces to clients.

---

# 19. Phase 9 — Authentication

Implement in this order:

### 9.1 Register

```text
POST /api/v1/auth/register
```

Flow:

```text
Validate input
    ↓
Normalize email
    ↓
Check duplicate
    ↓
Hash password
    ↓
Create user
    ↓
Create session
    ↓
Set HTTP-only cookie
    ↓
Return safe user object
```

Use Argon2id for password hashing.

Never return:

```text
passwordHash
session token
internal secrets
```

---

## 9.2 Login

```text
POST /api/v1/auth/login
```

Flow:

```text
Email/password
      ↓
Validate
      ↓
Find user
      ↓
Verify password
      ↓
Create session
      ↓
HTTP-only secure cookie
```

---

## 9.3 Current user

```text
GET /api/v1/auth/me
```

Returns:

```json
{
  "data": {
    "id": "...",
    "email": "...",
    "username": "...",
    "displayName": "..."
  }
}
```

---

## 9.4 Logout

```text
POST /api/v1/auth/logout
```

Actions:

```text
Revoke session
Clear cookie
```

---

# 20. Authentication Security Checklist

Implement:

```text
HTTP-only cookies
Secure cookies in production
SameSite protection
Session expiration
Session revocation
Argon2id
Login rate limiting
Registration rate limiting
Generic authentication errors
Password reset token expiry
```

Never put authentication tokens in:

```text
localStorage
sessionStorage
URL query parameters
```

---

# 21. Phase 10 — User/Profile

Implement:

```text
GET   /api/v1/users/me
PATCH /api/v1/users/me
GET   /api/v1/users/username/:username
```

Profile fields:

```text
displayName
bio
avatar
username
```

Dashboard page:

```text
/dashboard/settings
```

---

# 22. Phase 11 — Page CRUD

Implement:

```text
GET    /api/v1/pages
POST   /api/v1/pages
GET    /api/v1/pages/:id
PATCH  /api/v1/pages/:id
DELETE /api/v1/pages/:id
POST   /api/v1/pages/:id/publish
POST   /api/v1/pages/:id/unpublish
```

Every protected endpoint must verify:

```text
authenticated user
        +
resource ownership
```

Never rely on:

```text
pageId from frontend
```

without checking that it belongs to the authenticated user.

---

# 23. Phase 12 — Block APIs

Implement:

```text
POST   /api/v1/pages/:pageId/blocks
PATCH  /api/v1/pages/:pageId/blocks/:blockId
DELETE /api/v1/pages/:pageId/blocks/:blockId
POST   /api/v1/pages/:pageId/blocks/reorder
```

For reorder:

```json
{
  "items": [
    {
      "id": "block-1",
      "position": 0
    },
    {
      "id": "block-2",
      "position": 1
    }
  ]
}
```

Update positions inside a transaction.

---

# 24. Safe URL Validation

Only allow:

```text
https://
http://
```

Reject dangerous schemes:

```text
javascript:
data:
vbscript:
file:
```

Normalize URLs before storing them.

Also consider:

```text
maximum URL length
redirect abuse
obfuscated URLs
```

Do not automatically fetch arbitrary user URLs from your server.

---

# 25. Phase 13 — Public Profile

Public route:

```text
/[username]
```

Example:

```text
https://kachko.app/rohan
```

Flow:

```text
Request
  ↓
Find username
  ↓
Check page is published
  ↓
Load profile
  ↓
Load theme
  ↓
Load visible blocks
  ↓
Render server-side
```

Public response must not expose private fields.

---

# 26. Public Renderer Architecture

Create:

```text
features/public-profile/
├── PublicProfile.tsx
├── ProfileHeader.tsx
├── BlockRenderer.tsx
├── blocks/
│   ├── LinkBlock.tsx
│   ├── TextBlock.tsx
│   ├── ImageBlock.tsx
│   └── SocialBlock.tsx
└── ThemeRenderer.tsx
```

Block renderer:

```text
PageBlock
    ↓
type
    ↓
registry
    ↓
component
```

Do not write a huge:

```ts
if (type === "LINK") ...
else if (type === "TEXT") ...
else if (...)
```

inside one component.

---

# 27. Phase 14 — Public Page Cache

Initial cache key:

```text
page:{username}
```

Initial TTL:

```text
60–300 seconds
```

Better:

```text
Mutation
   ↓
Update DB
   ↓
Invalidate page cache
   ↓
Next public request regenerates data
```

For V1, correctness is more important than complicated distributed caching.

---

# 28. Phase 15 — Dashboard

Primary route:

```text
/dashboard
```

Layout:

```text
Sidebar
Header
Main content
Preview panel
```

Dashboard navigation:

```text
Home
Links
Appearance
Analytics
Settings
```

Mobile navigation should be designed independently rather than simply shrinking the desktop sidebar.

---

# 29. Phase 16 — Editor

This is one of the most important product areas.

Editor layout:

```text
+----------------------+-------------------------+
|                      |                         |
|     Editor           |      Live Preview       |
|                      |                         |
|  + Add block         |      Mobile Page        |
|  Drag/drop blocks    |                         |
|  Edit properties     |                         |
|                      |                         |
+----------------------+-------------------------+
```

Use:

```text
dnd-kit
```

for drag/drop.

---

# 30. Editor State

Use Zustand for temporary editor state.

Example state:

```text
selectedBlockId
blocks
activePanel
previewDevice
isDirty
```

Use TanStack Query for server state.

### Do not

Store all API data permanently in Zustand.

### Use

```text
TanStack Query → server state
Zustand        → local editor state
```

---

# 31. Autosave

Recommended behavior:

```text
User edits
    ↓
Local state changes
    ↓
500ms debounce
    ↓
API mutation
    ↓
Save
```

Display:

```text
Saving...
Saved
Unable to save
```

Never silently lose edits.

---

# 32. Optimistic Updates

Good candidates:

```text
Toggle visibility
Reorder blocks
Edit block title
Change theme
```

If mutation fails:

```text
Rollback local state
Show error
Retry option
```

Do not make every mutation optimistic automatically.

---

# 33. Phase 17 — Themes

Theme model:

```text
Theme
├── background
├── typography
├── buttons
└── cards
```

Start with approximately:

```text
6–10 polished system themes
```

Example categories:

```text
Minimal
Dark
Gradient
Creator
Professional
Elegant
Bold
Nature
```

Theme data should be configuration, not arbitrary CSS.

---

# 34. Theme Safety

Never allow users to submit arbitrary CSS like:

```text
<style>...</style>
```

or:

```text
background: url(...)
```

unless explicitly validated.

Theme configuration should use an allowlisted structure.

Example:

```json
{
  "background": {
    "type": "solid",
    "value": "#ffffff"
  },
  "buttons": {
    "radius": "large",
    "variant": "filled"
  }
}
```

---

# 35. Phase 18 — Social Profiles

Initial platforms:

```text
Instagram
YouTube
X
LinkedIn
Facebook
TikTok
GitHub
Discord
Twitch
Spotify
```

Store normalized profile data.

Allow:

```text
platform
username
url
position
visibility
```

Social icons should come from a controlled platform registry.

---

# 36. Phase 19 — Media

Use Cloudflare R2.

Flow:

```text
Frontend
   ↓
Request upload URL
   ↓
API validates user + file metadata
   ↓
Signed upload URL
   ↓
Browser uploads directly to R2
   ↓
API stores media metadata
```

Do not send large files through the NestJS API unless necessary.

Media record:

```text
id
userId
storageKey
url
mimeType
size
width
height
createdAt
```

---

# 37. Media Security

Allow only required MIME types.

For V1:

```text
image/jpeg
image/png
image/webp
image/gif
```

Set:

```text
maximum file size
maximum image dimensions
```

Consider image processing/resizing before production scale.

Never trust:

```text
file extension
Content-Type header
client-provided dimensions
```

Validate the actual file.

---

# 38. Phase 20 — Analytics

V1 events:

```text
PAGE_VIEW
LINK_CLICK
SOCIAL_CLICK
```

Endpoint:

```text
POST /api/v1/analytics/events
```

For browser delivery use:

```text
navigator.sendBeacon()
```

with:

```text
fetch(..., { keepalive: true })
```

as fallback.

---

# 39. Analytics Data

Initial fields:

```text
pageId
blockId
eventType
ipHash
country
city
device
browser
os
referrer
createdAt
```

Avoid storing raw IP addresses unless there is a clear, justified requirement.

Prefer:

```text
hashed / minimized data
```

with retention rules.

---

# 40. Analytics Dashboard

Initial metrics:

```text
Total views
Unique visitors
Link clicks
Click-through rate
Top links
Top referrers
Device breakdown
```

Date ranges:

```text
Today
7 days
30 days
```

Do not build advanced real-time analytics in V1.

---

# 41. Analytics Architecture Evolution

V1:

```text
Browser
  ↓
NestJS
  ↓
PostgreSQL
```

Later:

```text
Browser
  ↓
API
  ↓
Queue/Event Stream
  ↓
Analytics storage
  ↓
ClickHouse
```

Do not introduce ClickHouse until PostgreSQL analytics becomes an actual bottleneck.

---

# 42. Phase 21 — QR Code

Endpoint:

```text
GET /api/v1/pages/:id/qr
```

QR should point to:

```text
https://kachko.app/<username>
```

The dashboard should provide:

```text
Download QR
Copy page URL
Share
```

Prefer generating the QR on demand instead of permanently storing every QR image.

---

# 43. Phase 22 — SEO

For every public profile:

```text
title
description
canonical URL
Open Graph title
Open Graph description
Open Graph image
Twitter/X card metadata
```

Example:

```text
<title>Rohan | kachko</title>
<meta name="description" ... />
```

Generate metadata from profile data.

---

# 44. Phase 23 — Sharing

Dashboard actions:

```text
Copy URL
Share
Download QR
Open public page
```

Use the browser Web Share API where supported.

Fallback:

```text
Copy link
```

---

# 45. Phase 24 — Rate Limiting

Rate-limit at multiple levels.

### Authentication

```text
Register
Login
Forgot password
Reset password
```

### Public APIs

```text
Analytics ingestion
Public profile lookups
```

### User APIs

```text
Media upload URL
Import
Bulk mutations
```

Use Redis for distributed rate limits.

---

# 46. Phase 25 — Security Headers

At minimum review:

```text
Content-Security-Policy
Strict-Transport-Security
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
Frame protection
```

Do not blindly copy a CSP from another application.

Because kachko may embed YouTube/Spotify/etc., CSP must explicitly account for approved providers.

---

# 47. Phase 26 — Abuse Prevention

Create moderation models early even if the admin UI comes later.

Report reasons:

```text
SPAM
PHISHING
MALWARE
HARASSMENT
NSFW
COPYRIGHT
OTHER
```

User reporting:

```text
POST /api/v1/reports
```

Admin:

```text
GET   /api/v1/admin/reports
PATCH /api/v1/admin/reports/:id
```

---

# 48. Phase 27 — Admin

Initial admin capabilities:

```text
View users
View pages
View reports
Disable user
Unpublish page
Review abuse reports
View audit logs
```

Do not expose admin APIs without role checks.

Roles:

```text
USER
MODERATOR
ADMIN
```

---

# 49. Phase 28 — Audit Logging

Log security-sensitive actions:

```text
LOGIN
LOGOUT
PASSWORD_CHANGED
EMAIL_CHANGED
USERNAME_CHANGED
PAGE_CREATED
PAGE_DELETED
PAGE_PUBLISHED
PAGE_UNPUBLISHED
USER_DISABLED
REPORT_RESOLVED
```

Store:

```text
userId
action
resourceType
resourceId
metadata
createdAt
```

Avoid putting secrets into metadata.

---

# 50. Phase 29 — Testing Strategy

## Unit tests

Test:

```text
Username validation
URL validation
Password rules
Block validation
Theme validation
Authorization rules
Analytics calculations
```

## Integration tests

Test:

```text
Registration
Login
Page CRUD
Block CRUD
Publish/unpublish
Ownership checks
```

## E2E tests

Use Playwright.

Critical journey:

```text
Open app
  ↓
Register
  ↓
Choose username
  ↓
Create page
  ↓
Add link
  ↓
Change theme
  ↓
Publish
  ↓
Open public page
  ↓
Click link
  ↓
Check analytics
```

This should become the main release smoke test.

---

# 51. Phase 30 — Testing Matrix

| Feature | Unit | Integration | E2E |
|---|---:|---:|---:|
| Registration | ✓ | ✓ | ✓ |
| Login | ✓ | ✓ | ✓ |
| Username | ✓ | ✓ | ✓ |
| Page CRUD | ✓ | ✓ | ✓ |
| Blocks | ✓ | ✓ | ✓ |
| Reorder | ✓ | ✓ | ✓ |
| Themes | ✓ | ✓ | ✓ |
| Public profile | ✓ | ✓ | ✓ |
| Media | ✓ | ✓ | Optional |
| Analytics | ✓ | ✓ | ✓ |
| QR | ✓ | ✓ | Optional |
| Admin | ✓ | ✓ | Optional |

---

# 52. Phase 31 — CI Pipeline

GitHub Actions should run:

```text
Install dependencies
        ↓
Lint
        ↓
Typecheck
        ↓
Unit tests
        ↓
Integration tests
        ↓
Build
        ↓
Security checks
```

For pull requests:

```text
PR
 ↓
CI
 ↓
Review
 ↓
Merge
```

Do not allow production deployment when required checks fail.

---

# 53. Phase 32 — Database CI

For integration tests:

```text
Start PostgreSQL
Run migrations
Seed test data
Run tests
Destroy database
```

Do not use a developer's local database in CI.

---

# 54. Phase 33 — Local Docker Development

Target local architecture:

```text
Browser
   |
   +--> Next.js :3000
   |
   +--> NestJS :4000
             |
             +--> PostgreSQL :5432
             |
             +--> Redis :6379
```

This is sufficient for V1 development.

---

# 55. Phase 34 — Staging

Staging should resemble production.

Suggested:

```text
Cloudflare
     |
     +--> Vercel Preview/Staging
     |
     +--> Azure Container Apps
              |
              +--> PostgreSQL
              +--> Redis
              +--> R2
```

Use separate:

```text
database
Redis
R2 bucket
secrets
analytics data
```

Do not let staging access production data.

---

# 56. Phase 35 — Production Deployment

Recommended initial production:

```text
Cloudflare
    |
    +--> Vercel
    |
    +--> Azure Container Apps
             |
             +--> Azure Database for PostgreSQL
             |
             +--> Managed Redis

Cloudflare R2
    |
    +--> User media
```

---

# 57. Production Environment Variables

### Web

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_ANALYTICS_KEY
```

Only public values belong here.

### API

```text
DATABASE_URL
REDIS_URL

R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_PUBLIC_URL

SESSION_SECRET
SENTRY_DSN
```

Never expose API secrets through Next.js public environment variables.

---

# 58. Phase 36 — Observability

Implement:

```text
Pino logging
Sentry
OpenTelemetry
```

Track:

```text
API error rate
API latency
Database latency
Redis failures
R2 upload failures
Public page errors
Authentication failures
```

Important API metric:

```text
P95 response time
```

Initial target:

```text
CRUD API P95 < 300ms
```

---

# 59. Public Performance Targets

Initial targets:

```text
LCP < 2 seconds under normal conditions
CLS < 0.1
INP < 200ms
```

Public pages should avoid unnecessary JavaScript.

Prefer:

```text
Server Components
optimized images
minimal client bundles
CDN caching
```

---

# 60. Phase 37 — Product Polish

Implement basic loading/error/empty states, mobile usability, and accessibility with each feature. After core functionality works, refine:

```text
Empty states
Loading skeletons
Toasts
Undo actions
Keyboard shortcuts
Mobile editor
Accessibility
Animation
Micro-interactions
```

Do not spend a week polishing the landing page before the editor works.

---

# 61. Accessibility Checklist

Every dashboard screen should support:

```text
Keyboard navigation
Visible focus
Semantic buttons
Accessible labels
Form error messages
Color contrast
Screen reader-friendly controls
Drag/drop alternatives
```

For drag/drop, provide keyboard/manual ordering controls as an alternative.

---

# 62. Recommended Component System

`packages/ui` should contain reusable primitives:

```text
Button
Input
Textarea
Dialog
Drawer
Dropdown
Popover
Tabs
Tooltip
Card
Avatar
Badge
Toast
Skeleton
Select
Switch
```

Do not put business logic inside the shared UI package.

---

# 63. Package Responsibilities

## packages/ui

Reusable visual components.

## packages/types

Shared TypeScript contracts.

## packages/validation

Shared Zod schemas.

## packages/config

Environment/config helpers.

## packages/eslint-config

Shared lint rules.

## packages/tsconfig

Shared TypeScript configurations.

---

# 64. API Module Responsibilities

## auth

Authentication and sessions.

## users

Profile and username.

## pages

Page lifecycle.

## blocks

Page block lifecycle.

## themes

Theme catalog and assignment.

## social

Social profiles.

## media

Upload URLs and media metadata.

## analytics

Event collection and reporting.

## qr

QR generation.

## imports

Future import functionality.

## moderation

Reports and abuse controls.

## admin

Administrative actions.

## health

Liveness/readiness checks.

---

# 65. API Dependency Direction

Prefer:

```text
Controller
   ↓
Service
   ↓
Repository
   ↓
Prisma
```

Validation:

```text
Request
   ↓
DTO/schema
   ↓
Controller
```

Authorization:

```text
Controller/Guard
   ↓
Service ownership check
```

Do not allow controllers to contain complex business logic.

---

# 66. Caching Strategy

Cache only data that benefits from caching.

Good candidates:

```text
Published public page
System themes
Platform registry
Feature flags
```

Avoid caching:

```text
passwords
sessions unnecessarily
rapidly changing editor state
```

Cache invalidation should happen immediately after relevant mutation.

---

# 67. Transaction Strategy

Use database transactions for operations such as:

```text
Create page + default theme
Reorder blocks
Delete page + blocks
Publish/unpublish state transitions
Account deletion
Moderation actions affecting multiple records
```

---

# 68. Idempotency

For important mutation endpoints consider:

```text
Idempotency-Key
```

especially:

```text
media operations
analytics ingestion
future payments
imports
```

Do not implement idempotency everywhere before there is a real need.

---

# 69. Import Feature

V1 can include a basic import flow later.

Possible flow:

```text
User provides source/profile URL
        ↓
Validate URL
        ↓
Fetch only approved sources
        ↓
Parse supported data
        ↓
Show preview
        ↓
User confirms
        ↓
Create blocks
```

Never blindly scrape arbitrary websites from the backend.

Start with manually supported import formats/providers.

---

# 70. Development Milestones

## Milestone 1 — Foundation

Done when:

```text
Monorepo works
Next.js works
NestJS works
Postgres works
Redis works
Prisma works
CI works
```

---

## Milestone 2 — Identity

Done when:

```text
Register works
Login works
Logout works
Session works
Username selection works
```

---

## Milestone 3 — Page Core

Done when:

```text
User can create page
User can edit profile
User can publish page
Public page loads
```

---

## Milestone 4 — Blocks

IMAGE completion depends on Milestone 7 (Media); implement its contract/UI earlier using fixtures if useful.

Done when:

```text
Add link
Edit link
Delete link
Reorder links
Add text
Add image
```

---

## Milestone 5 — Editor

Done when:

```text
Drag/drop
Live preview
Autosave
Mobile responsive editor
```

---

## Milestone 6 — Appearance

Done when:

```text
Themes
Typography
Buttons
Background
Preview
```

---

## Milestone 7 — Media

Done when:

```text
Upload avatar
Upload image
R2 storage
Media metadata
```

---

## Milestone 8 — Analytics

Done when:

```text
Page views
Link clicks
Basic dashboard
Date ranges
```

---

## Milestone 9 — Growth

Done when:

```text
QR
SEO
Open Graph
Share actions
```

---

## Milestone 10 — Production

Done when:

```text
Security review
Abuse controls
CI/CD
Monitoring
Backups
Smoke tests
Production deployment
```

---

# 71. Exact Development Order

Work through these completion gates in order. Tasks in the same row can run in parallel after the contract is agreed. Later UI mockups may start early, but a feature cannot pass its gate until its real dependencies work. Tests, basic security, and CI start with foundation work and continue throughout.

The authoritative step-by-step task matrix is at the [top of this document](#step-by-step-execution-flow), with separate **Rohan (BE)** and **Girish (FE)** columns. Use its dependency and completion-gate columns for each step.

**First priority:** finish steps 1–4 before advanced editor/appearance work. Girish starts UI shells during step 1 and contract-backed forms during step 2; Girish does not wait for the whole backend. Add cache layers only with explicit invalidation, including any Next.js/CDN cache, so unpublish and moderation do not expose stale pages.

---

# 72. First Vertical Slice

The first real product slice should be:

```text
Register
   ↓
Choose username
   ↓
Create page
   ↓
Add one link
   ↓
Publish
   ↓
Open /username
```

If this works end-to-end, the architecture is validated.

This should happen before building:

```text
advanced themes
analytics
QR
imports
admin dashboards
```

---

# 73. First UI Screens

Build these screens first:

```text
/
```

Landing page.

```text
/register
```

Registration.

```text
/login
```

Login.

```text
/onboarding/username
```

Username selection.

```text
/dashboard
```

Main editor.

```text
/[username]
```

Public page.

The public page and dashboard are the two highest-priority product experiences.

---

# 74. Suggested Dashboard Layout

Desktop:

```text
┌─────────────────────────────────────────────────────────┐
│ Logo                         Preview   Share   Profile   │
├───────────────┬─────────────────────────┬───────────────┤
│               │                         │               │
│ Links         │       Editor            │   Preview     │
│ Appearance    │                         │               │
│ Analytics     │   + Add block            │    Phone      │
│ Settings      │                         │    Mockup     │
│               │                         │               │
└───────────────┴─────────────────────────┴───────────────┘
```

Mobile:

```text
┌─────────────────────────┐
│ Header                  │
├─────────────────────────┤
│                         │
│ Editor                  │
│                         │
├─────────────────────────┤
│                         │
│ Preview                 │
│                         │
├─────────────────────────┤
│ Links Appearance More   │
└─────────────────────────┘
```

---

# 75. Link Editor UX

When adding a link:

```text
Title
URL
Icon
Thumbnail
Open in new tab
Visibility
```

Good UX:

```text
+ Add link
```

opens a simple panel.

After save:

```text
Link appears immediately in preview.
```

Avoid complicated forms for simple blocks.

---

# 76. Error UX

Every important operation should have:

```text
Loading
Success
Error
Retry
```

Example:

```text
Saving...
Saved just now
```

If API fails:

```text
Couldn't save your changes.
Retry
```

Do not show raw API errors.

---

# 77. Empty States

Dashboard first-time state:

```text
Create your first link

Add your website, social profile,
portfolio, store, or anything you want
people to discover.

[ Add your first link ]
```

Avoid an empty screen with no explanation.

---

# 78. Production Checklist

Before launch:

### Product

```text
✓ Registration
✓ Login
✓ Username
✓ Profile
✓ Link blocks
✓ Public page
✓ Publish/unpublish
✓ Themes
✓ Mobile layout
```

### Security

```text
✓ HTTPS
✓ Secure cookies
✓ Password hashing
✓ Rate limiting
✓ Authorization
✓ Input validation
✓ Safe URLs
✓ Security headers
✓ Abuse reporting
```

### Reliability

```text
✓ Database backups
✓ Health checks
✓ Error monitoring
✓ Logs
✓ CI/CD
✓ Rollback plan
```

### Performance

```text
✓ Public page optimized
✓ Images optimized
✓ CDN
✓ Cache
✓ Minimal client JS
```

### Legal/product

```text
✓ Terms
✓ Privacy policy
✓ Abuse reporting
✓ Account deletion
✓ Data retention policy
```

---

# 79. Backup Strategy

Initial target:

```text
RPO < 24 hours
RTO < 4 hours
```

At minimum:

```text
Automated PostgreSQL backups
Recovery procedure
Backup monitoring
Periodic restore test
```

A backup that has never been restored/tested should not be considered fully reliable.

---

# 80. Data Deletion

Plan account deletion from the beginning.

Flow:

```text
User requests deletion
        ↓
Confirm identity
        ↓
Disable account
        ↓
Delete/anonymize owned data
        ↓
Delete media
        ↓
Revoke sessions
        ↓
Record audit event
```

Define retention periods for:

```text
analytics
audit logs
reports
deleted accounts
media
```

---

# 81. Performance Optimization Order

When performance becomes an issue:

```text
1. Measure
2. Identify bottleneck
3. Fix database queries
4. Optimize payload size
5. Cache
6. Optimize images
7. Reduce JS
8. Scale infrastructure
```

Do not scale infrastructure before measuring.

---

# 82. When to Introduce More Infrastructure

### Redis

Use now for:

```text
rate limiting
short-lived caching
```

### Queue

Introduce when:

```text
analytics
emails
media processing
imports
```

become asynchronous workloads.

### ClickHouse

Introduce when:

```text
analytics query volume
retention
aggregation cost
```

makes PostgreSQL unsuitable.

### Microservices

Only when there is a clear operational or scaling boundary.

Do not split NestJS into microservices just because the application has many modules.

---

# 83. Git Commit Plan

Recommended commits:

```text
chore: initialize kachko monorepo
chore: configure pnpm workspace
chore: add turborepo
feat(web): initialize nextjs application
feat(api): initialize nestjs application
chore: add local postgres and redis
feat(db): add initial prisma schema
feat(api): add api foundation
feat(auth): add registration
feat(auth): add login sessions
feat(users): add username management
feat(pages): add page crud
feat(blocks): add link blocks
feat(public): add public profile renderer
feat(editor): add link editor
feat(editor): add drag and drop
feat(editor): add autosave
feat(themes): add system themes
feat(social): add social profiles
feat(media): add r2 uploads
feat(analytics): add page view tracking
feat(analytics): add link click tracking
feat(qr): add qr generation
feat(seo): add public metadata
feat(security): add rate limiting
feat(moderation): add reports
test(e2e): add core user journey
ci: add github actions
chore: prepare staging deployment
chore: prepare production deployment
```

Keep commits small enough to review.

---

# 84. Suggested Task Board

Create two owner-specific tickets for each step in the opening task matrix: `BE-01` / `FE-01` through `BE-11` / `FE-11`. Assign every `BE-*` ticket to **Rohan** and every `FE-*` ticket to **Girish**. Use the respective owner column as each ticket's scope and the completion gate as the shared acceptance criteria. These are planned tasks; the existing scaffold only partially covers step 1.

| Status | Meaning |
|---|---|
| Todo | Scope, owner and dependencies recorded |
| In progress | Owner implementing |
| Ready for integration | API contract/fixtures or endpoint/UI ready for the other owner |
| In review | Integrated behavior and relevant checks verified; PR awaiting review |
| Done | Both confirm the step's completion gate |

Each ticket includes its step, owner, dependency ticket IDs, contract link, acceptance cases, test evidence, and PR link. Mark blocking dependencies explicitly (for example, FE-03 integration needs BE-03; FE-07 upload integration needs BE-07).

---

# 85. Definition of Done

PRs are checked by the [automatic documentation review agent](04-PR-REVIEW-AGENT.md). Rohan configures its API secret and required GitHub status check; Rohan and Girish address cited findings before merging. The agent supplements the feature checks below.

A feature is not done merely because the UI works.

A feature is done when:

```text
UI implemented
API implemented
Validation implemented
Authorization implemented
Database migration added
Error handling implemented
Loading state implemented
Tests added
Typecheck passes
Lint passes
Documentation updated
```

For public-facing features also verify:

```text
Mobile
Desktop
Accessibility
SEO
Performance
Security
```

---

# 86. Recommended Weekly Development Plan

This is a planning estimate for two developers, not a fixed deadline. Section 71 completion gates take priority over calendar dates.

| Week | Rohan — BE | Girish — FE | Target |
|---|---|---|---|
| 1 | Foundation, local services, initial identity schema/contracts, CI | Verify frontend, UI primitives, API client/fixtures, auth/dashboard shells | Steps 1–2 |
| 2 | Auth, username, profile, session security | Integrate auth/onboarding/profile | Step 3 |
| 3 | Pages, LINK, publish/public APIs, ownership/cache checks | Basic link dashboard, publish, public renderer | Step 4: first real demo |
| 4 | Reorder/TEXT, theme and social APIs | Editor, autosave, preview; appearance/social UI as APIs arrive | Steps 5–6, carry over if needed |
| 5 | R2/IMAGE, analytics APIs | Upload/image flow, finish appearance/social | Step 7; begin step 8 integration |
| 6 | Analytics integration, QR, password reset, moderation/deletion APIs | Analytics, share/SEO/QR, reset/report/deletion UI | Steps 8–10, carry over if needed |
| 7 | Staging, operational checks, security fixes | E2E, responsive/accessibility checks, staging fixes | Integrated staging candidate |
| 8 | Restore/rollback, monitoring, production preparation | Performance, browser checks, release verification | Step 11 when gates pass |

Run feature tests every week and add E2E coverage with the first working journey in week 3. Do not defer security or all testing until weeks 7–8.

---

# 87. The First 10 Development Actions

1. **Both:** review the ownership and contract decisions at the top of this file.
2. **Rohan (BE):** verify the existing root pnpm/Turborepo setup and the NestJS scaffold in `apps/api`.
3. **Girish (FE, parallel with 2):** verify `apps/kachko-fe`, add missing FE checks, and start responsive UI primitives/auth/dashboard shells.
4. **Rohan (BE):** add PostgreSQL/Redis Docker Compose services and document local environment setup.
5. **Rohan (BE):** add Prisma with User/Session and the next slice's Page/PageBlock/Theme models, migrations and minimal seed data; defer unused future models until needed.
6. **Both:** agree identity DTOs, username timing, error envelopes and cookie/CORS/CSRF behavior.
7. **Rohan (BE):** publish shared contracts and OpenAPI examples; **Girish (FE):** build a typed client and matching fixtures.
8. **Rohan (BE):** implement auth/session/profile APIs and their security checks; **Girish (FE):** implement the corresponding forms and UI states.
9. **Both:** integrate and verify register/login/profile/logout against the real API.
10. **Both:** build the page/link/publish/public-URL slice in step 4 before advanced features.

The repository already exists: do not recreate it or duplicate the frontend. Foundation verification includes app startup, lint, typecheck, build and applicable tests. Add missing scripts/tools before claiming the root checks cover both applications.

---

# 88. First Product Demo Target

Your first meaningful demo should look like this:

```text
                    kachko

                [ Register ]

                       ↓

                Choose username

                  @rohan

                 [ Continue ]

                       ↓

             Create your page

            ┌───────────────────┐
            │      Rohan        │
            │   Software Dev    │
            │                   │
            │  [ My Portfolio ] │
            │  [ GitHub ]       │
            │  [ LinkedIn ]     │
            └───────────────────┘

                       ↓

                   Publish

                       ↓

          kachko.app/rohan
```

That is the first major success condition.

---

# 89. V1 Feature Priority

## P0 — Must Have

```text
Authentication
Username
Profile
One public page
Links
Text
Images
Drag/drop
Themes
Publish/unpublish
Public rendering
Mobile responsive
Basic analytics
SEO
QR
Security/rate limiting
Social profiles
Account deletion
Abuse reporting and basic moderation
Password reset
```

## P1 — Should Have

```text
OAuth
Video embeds
Import
Advanced moderation dashboard
Advanced analytics
```

## P2 — Later

```text
Custom domains
Multiple pages
Scheduling
Link expiration
Teams
Newsletter
Contact forms
Donations
Digital products
Store
Booking
Affiliate tools
Webhooks
Public API
Mobile apps
```

---

# 90. Final Architecture Rule

Do not optimize for:

```text
"Can kachko handle 100 million users?"
```

at the beginning.

Optimize for:

```text
"Can our two-person team build, understand, test,
deploy and maintain this product?"
```

The initial architecture should therefore be:

```text
Next.js
    +
NestJS modular monolith
    +
PostgreSQL
    +
Redis
    +
R2
    +
Cloudflare
```

This is enough to build a serious V1.

When real traffic reveals a bottleneck, evolve the architecture based on measured evidence.

---

# 91. Immediate Next Step

**Rohan (BE):** verify the NestJS scaffold, then set up local PostgreSQL/Redis and Prisma. **Girish (FE):** verify the existing frontend and build UI primitives plus auth/dashboard shells in parallel.

Next, agree the identity contract and integrate authentication. Use section 71 as the execution plan and section 84 to track ownership and blockers.

The first shared demo remains:

```text
Register with username → Create page → Add link → Publish → Open public URL
```

Complete this with real API/database data before moving to advanced features.

---
