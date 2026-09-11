# kachko — High-Level Design (HLD)

**Document status:** V1 architecture baseline  
**Product:** Free, user-friendly Linktree competitor / personal link-page platform  
**Primary language:** TypeScript  
**Architecture style:** Modular monolith + composable page/block model  
**Target deployment:** Vercel + Azure Container Apps + PostgreSQL + Redis + Cloudflare R2/CDN

---

## 1. Product Vision

kachko is a fast, modern, free-to-use personal landing-page platform. A user creates a public page containing their profile, links, social accounts, media and embeds, chooses a visual theme, and shares one URL everywhere.

### V1 product goals

- Free core product
- Extremely simple onboarding
- Mobile-first public pages
- Excellent UI/UX
- Fast public page rendering
- Drag-and-drop page editor
- Links, social profiles, text, images and embeds
- Themes/templates
- Basic analytics
- QR code
- SEO and social sharing metadata
- Import from Linktree where technically and legally appropriate
- Strong security and abuse controls

### Explicit V1 non-goals

- Payments/subscriptions
- Team collaboration
- Enterprise SSO
- Marketplace
- Complex CRM
- Full e-commerce
- Advanced automation
- Custom domains as a launch blocker

The architecture must allow these later without changing the core Page/Block model.

---

## 2. Architecture Principles

1. **TypeScript-first** across frontend, backend and shared packages.
2. **Composable blocks** instead of a separate table for every content type.
3. **Public pages are performance-critical** and must be independently optimized from the dashboard.
4. **Backend owns business rules**; frontend validation is not trusted.
5. **HTTP-only secure sessions** rather than tokens in localStorage.
6. **PostgreSQL is the system of record.**
7. **Redis is for cache/rate limits/transient workloads**, not primary persistence.
8. **Object storage is used for media**, not PostgreSQL blobs.
9. **Analytics is abstracted behind a service** so V1 PostgreSQL storage can later move to ClickHouse.
10. **Modular monolith first**; microservices only when scale or team boundaries justify them.
11. **Infrastructure should be simple enough for a small team to operate.**
12. **Privacy by design:** minimize collection of sensitive analytics data.

---

## 3. System Context

```text
                         ┌──────────────────────┐
                         │       Internet       │
                         └──────────┬───────────┘
                                    │ HTTPS
                         ┌──────────▼───────────┐
                         │      Cloudflare      │
                         │ DNS / CDN / WAF / TLS│
                         └───────┬───────┬──────┘
                                 │       │
                         public  │       │ API
                                 │       │
                    ┌────────────▼─┐   ┌─▼────────────────┐
                    │    Next.js   │   │    NestJS API    │
                    │    Vercel    │   │ Azure Container  │
                    │              │   │       Apps       │
                    └──────┬───────┘   └──────┬───────────┘
                           │                  │
                           │          ┌───────┼───────────┐
                           │          │       │           │
                           │          ▼       ▼           ▼
                           │       Redis  PostgreSQL   Cloudflare
                           │                            R2
                           │
                           ▼
                    Public rendered page
```

---

## 4. Major Components

### 4.1 Web application

**Next.js + React + TypeScript**

Responsibilities:

- Marketing site
- Authentication UI
- Dashboard
- Page editor
- Live preview
- Public page rendering
- SEO metadata
- Social preview metadata
- Client-side interaction

### 4.2 API

**NestJS + TypeScript**

Responsibilities:

- Authentication
- User management
- Username management
- Page CRUD
- Block CRUD/reordering
- Themes/templates
- Media upload authorization
- Analytics ingestion/querying
- QR generation
- Import
- Moderation
- Admin operations

### 4.3 PostgreSQL

System of record for:

- Users
- Sessions
- Pages
- Blocks
- Themes
- Social profiles
- Media metadata
- Analytics
- Audit logs
- Domains
- Reports
- Feature flags

### 4.4 Redis

Used for:

- Public-page caching
- API rate limiting
- Short-lived state
- Idempotency where needed
- Future queue support

### 4.5 Cloudflare R2

Used for:

- Avatars
- Images
- Other user media

CDN delivery should happen through Cloudflare.

---

## 5. Domain Model

```text
User
 │
 ├── Session
 │
 ├── Page
 │    │
 │    ├── Theme
 │    ├── PageBlock[]
 │    └── SocialProfile[]
 │
 ├── Media[]
 │
 └── AuditLog[]

PageBlock
 ├── LINK
 ├── TEXT
 ├── IMAGE
 ├── VIDEO
 ├── SOCIAL
 ├── DIVIDER
 ├── YOUTUBE
 ├── SPOTIFY
 ├── EMAIL
 ├── PHONE
 └── LOCATION
```

The central abstraction is **Page → Blocks**.

---

## 6. V1 Functional Modules

### Identity

- Register
- Login
- Logout
- Session management
- Password reset
- Google/GitHub OAuth
- Username availability

### Profile

- Display name
- Avatar
- Bio
- Social profiles

### Pages

- Create
- Edit
- Publish/unpublish
- Delete
- Preview
- Public URL

### Blocks

- Create
- Update
- Delete
- Hide/show
- Reorder
- Type-specific validation

### Appearance

- Background
- Typography
- Buttons
- Cards
- Fonts
- Themes
- Templates

### Analytics

- Page views
- Link clicks
- Social clicks
- CTR
- Referrers
- Country
- Device
- Browser
- OS

### Media

- Upload
- Resize/optimize
- Delete
- CDN delivery

### Growth

- QR code
- Share
- SEO
- Import

### Platform

- Rate limiting
- Moderation
- Reports
- Audit logs
- Admin
- Feature flags

---

## 7. Public Page Architecture

Public URL:

```text
https://kachko.example/rohan
```

Request flow:

```text
Browser
  ↓
Cloudflare CDN
  ↓
Next.js
  ↓
Redis/cache
  ↓
API if cache miss
  ↓
PostgreSQL
  ↓
Redis
  ↓
Next.js
  ↓
HTML
```

Public pages should use Server Components and caching wherever possible.

Dashboard can be substantially more client-heavy.

---

## 8. Caching Strategy

Primary key:

```text
page:{username}
```

Example:

```text
page:rohan
```

TTL:

```text
60–300 seconds
```

On page mutation:

```text
DB update
   ↓
invalidate page:{username}
```

For stronger consistency, use explicit invalidation immediately after successful writes.

---

## 9. Analytics Architecture

V1:

```text
Browser
   ↓
POST /api/v1/analytics/events
   ↓
AnalyticsService
   ↓
PostgreSQL
```

Scale-ready abstraction:

```text
Browser
   ↓
Analytics API
   ↓
Queue
   ↓
Worker
   ↓
ClickHouse
```

Do not make the public page wait for analytics persistence.

Analytics collection should be asynchronous/fire-and-forget from the UI perspective.

---

## 10. Media Architecture

```text
Browser
  ↓
API asks for upload authorization
  ↓
Pre-signed upload
  ↓
Cloudflare R2
  ↓
CDN
```

The API should not proxy large media uploads unless necessary.

Store only metadata in PostgreSQL.

---

## 11. Security Architecture

### Authentication

- Secure HTTP-only cookie
- Secure flag in production
- SameSite=Lax or stricter where compatible
- Password hashing using Argon2id or equivalent
- Session expiry/revocation
- OAuth state validation

### API security

- DTO/schema validation
- Authorization on every protected resource
- Rate limiting
- Request-size limits
- Strict CORS
- Security headers
- CSRF strategy appropriate to cookie authentication
- No secrets in client bundles

### Content security

Allow only safe URL schemes for user links:

- `https`
- `http` where explicitly supported
- `mailto`
- `tel`

Reject dangerous schemes such as `javascript:`.

### Privacy

- Avoid raw IP persistence where possible
- Prefer hashing/truncation for analytics
- Document analytics retention
- Provide account/data deletion

---

## 12. Scalability Strategy

### V1

```text
Next.js
   +
1–N API containers
   +
PostgreSQL
   +
Redis
   +
R2
```

### Later

```text
Cloudflare
    ↓
Next.js
    ↓
API Gateway
    ↓
Modular services
    ├── Auth
    ├── Pages
    ├── Media
    ├── Analytics
    └── Notifications
```

Do not split services prematurely.

---

## 13. Deployment Architecture

Recommended initial production deployment:

```text
Cloudflare
 ├── DNS
 ├── CDN
 ├── WAF
 └── TLS

Vercel
 └── Next.js

Azure Container Apps
 └── NestJS API

Azure Database for PostgreSQL
 └── PostgreSQL

Managed Redis
 └── Redis

Cloudflare R2
 └── Media
```

The API remains stateless so multiple containers can run concurrently.

---

## 14. CI/CD

```text
Pull Request
   ↓
Lint
   ↓
Type check
   ↓
Unit tests
   ↓
Integration tests
   ↓
Build
   ↓
Security/dependency scan
   ↓
E2E tests
   ↓
Merge
   ↓
Build Docker image
   ↓
Push image
   ↓
Deploy staging
   ↓
Smoke tests
   ↓
Production deployment
```

---

## 15. Environments

```text
local
development
staging
production
```

Production secrets must come from a managed secret store/environment configuration.

---

## 16. Observability

### Errors

Sentry

### Structured logging

Pino

### Tracing

OpenTelemetry

### Metrics

Track:

- API latency
- API error rate
- DB latency
- Redis latency
- public page render latency
- cache hit ratio
- analytics ingestion rate
- upload failures

---

## 17. Availability and Recovery

Initial targets:

```text
RPO < 24 hours
RTO < 4 hours
```

Production PostgreSQL should have:

- automated backups
- point-in-time recovery where supported
- restore testing

R2 should have appropriate versioning/lifecycle controls.

---

## 18. Performance Targets

Public pages:

- CDN/cache-first delivery
- LCP target < 2 seconds under normal conditions
- CLS < 0.1
- INP < 200 ms target
- optimized AVIF/WebP media
- minimal client JavaScript

API:

- normal CRUD P95 < 300 ms target
- cacheable public-page data P95 substantially lower

Targets should be validated with real production telemetry rather than treated as guarantees.

---

## 19. V1 Product Journey

```text
Landing
  ↓
Sign up
  ↓
Choose username
  ↓
Create profile
  ↓
Add first link
  ↓
Choose template
  ↓
Publish
  ↓
Copy/share URL
  ↓
Receive views/clicks
```

The first successful page should be achievable in under two minutes.

---

## 20. Future Extension Points

The architecture should support:

- Custom domains
- Subdomains
- Multiple pages per user
- Link scheduling
- Link expiration
- Team accounts
- Collaboration
- Newsletter collection
- Contact forms
- Donations
- Digital products
- Booking
- Affiliate tracking
- Store
- Advanced analytics
- Webhooks
- API access
- Mobile application

---

## 21. Recommended V1 Stack

| Area | Technology |
|---|---|
| Language | TypeScript |
| Frontend | Next.js + React |
| UI | Tailwind CSS + shadcn/ui |
| Editor | dnd-kit |
| Client state | Zustand |
| Server state | TanStack Query |
| Forms | React Hook Form |
| Validation | Zod |
| Backend | NestJS |
| API | REST + OpenAPI |
| ORM | Prisma |
| DB | PostgreSQL |
| Cache | Redis |
| Storage | Cloudflare R2 |
| CDN/WAF | Cloudflare |
| Frontend hosting | Vercel |
| API hosting | Azure Container Apps |
| Tests | Vitest + Playwright |
| Logging | Pino |
| Monitoring | Sentry + OpenTelemetry |
| Monorepo | Turborepo + pnpm |
| Containers | Docker |
| CI/CD | GitHub Actions |

---

## 22. Architectural Decision Summary

**AD-001:** Modular monolith instead of microservices for V1.  
**AD-002:** Next.js for web/public rendering, NestJS for business APIs.  
**AD-003:** Page blocks stored using PostgreSQL JSONB for extensibility.  
**AD-004:** Media stored in object storage.  
**AD-005:** Redis used for cache/rate limits.  
**AD-006:** Analytics abstracted so storage can later move to ClickHouse.  
**AD-007:** Public pages optimized independently from dashboard.  
**AD-008:** Secure HTTP-only sessions.  
**AD-009:** API versioned under `/api/v1`.  
**AD-010:** No Kubernetes requirement for V1.

