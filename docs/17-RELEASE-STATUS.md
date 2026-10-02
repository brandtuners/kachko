# Kachko release status

This file records implementation evidence separately from the product roadmap. A feature described in a roadmap is not considered shipped merely because it appears in a design document.

## V1 repository status

The frontend and API contain the V1 product surface: identity and session flows, multiple pages per user, the block editor and public renderer, appearance controls, media, analytics, QR/share, moderation, admin routes, and account controls.

The remaining repository-level release gaps were closed with:

- editor autosave with optimistic rollback, visible save state, retained drafts, and retry;
- media upload progress and retry;
- server-generated request IDs in responses, structured request logs, and correlated error responses;
- a database-backed Playwright journey covering registration, page/block creation, a real image upload, appearance, socials, publish, public rendering, click analytics, and QR;
- CI Postgres and Redis services for the browser journey;
- automated dependency update proposals;
- a scheduled/manual logical backup-and-restore drill and bounded load smoke.

Repository verification consists of lint, type checking, unit/integration tests, a production build, and Playwright desktop/mobile coverage.

## External V1 release gates

These cannot be completed by repository code alone and must be verified against isolated staging and production-provider accounts:

- production-cookie, CORS, and CSRF behavior on the deployed domains;
- the real Google OAuth callback;
- R2 upload and deletion behavior with the production-equivalent bucket CORS policy;
- provider-managed PostgreSQL backups/PITR and an operator restore drill;
- monitoring destinations, alert delivery, cost alerts, rollback, and DNS/TLS;
- destructive account and moderation flows against disposable staging data.

The CI restore drill validates the repository's logical backup tooling. It does not replace a provider backup/PITR exercise.

## Post-V1 status

V1.1 Conversion Basics is implemented in the repository. It includes:

- intent-first conversion choices while retaining the complete block library;
- `WHATSAPP`, `FORM`, and `SUBSCRIBE` editor and public-renderer support;
- creator-owned forms and fields, public submissions, contact deduplication, consent, notes, tags, filters, and CSV export;
- conversion events and a creator-scoped funnel;
- rate limiting, honeypot handling, payload limits, field validation, normalization, HTML removal, spam heuristics, and CSV formula-injection protection;
- browser coverage for contact and subscriber capture, deduplication, tag filtering, export, analytics, and cross-creator isolation.

See [V1.1 Conversion Basics](18-V1.1-CONVERSION-BASICS.md) for endpoints, behavior, and verification. Staged percentage rollout remains an operational deployment decision; V1.2 and later releases remain roadmap scope.
