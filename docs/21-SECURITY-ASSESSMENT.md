# Kachko security assessment

Assessment date: 2026-10-28. Target: the current local working tree, including the uncommitted social, billing, and short-link implementation.

This was a source-assisted local security assessment with real HTTP/PostgreSQL/Redis integration tests, dependency advisory checks, and limited production-frontend HTTP probes. It is not a completed penetration test of a deployed environment. No production data was modified, no external accounts were changed, and no real Instagram messages or payment transactions were sent.

## Results

| Check | Result |
| --- | --- |
| API unit, validation, provider-fixture, and HTTP foundation tests | 89 passed |
| Frontend tests, including streamed request limits | 20 passed |
| Disposable PostgreSQL/Redis infrastructure tests, including nested security scenarios | 7 passed |
| API build | Passed |
| Frontend production build, Next.js 15.5.28 | Passed, with workspace-root and telemetry bundling warnings |
| API and frontend lint | Passed |
| `git diff --check` | Passed |
| Production dependency audit before updates | 35 advisory matches: 3 critical, 17 high, 12 moderate, 3 low |
| Production dependency audit after updates | 1 high advisory; no critical, moderate, or low matches |
| Secret-pattern scan | No matches in 313 tracked/untracked, non-ignored working-tree text files |

Test totals include functional regressions as well as security tests; they are not a count of distinct vulnerabilities or exhaustive attack coverage. Dependency advisories are package/version matches, not proof that every vulnerable behavior is reachable in this application.

## Findings fixed

### SEC-01 — High: legacy credentials remained usable after Clerk account migration

The legacy registration endpoint can create an account before email verification. When a verified Clerk identity with the same email was linked to that account, its old password, sessions, password-reset tokens, and legacy Google grants remained valid. Someone who pre-registered another person's email could retain access after that person signed in through Clerk. Legacy credentials also provided a path outside Clerk authentication controls.

Before remediation, the new regression test demonstrated that a user with `clerkUserId` could reach legacy session issuance rather than being rejected. The infrastructure regression then exercised the real migration transaction and HTTP authentication endpoints against disposable databases.

Changes:

- Clear the legacy password when linking the verified Clerk identity.
- Revoke old sessions, consume outstanding reset tokens, and remove legacy Google grants in the same transaction.
- Reject legacy password, session, and Google authentication for every Clerk-managed user, including accounts migrated before this patch.
- Block new legacy reset requests and Google linking for Clerk-managed users.
- Prevent reset confirmation from setting a password on a Clerk-managed, suspended, or deleted account.
- Constrain the migration update to an account that has not already been linked.

Verified: old cookies and passwords return 401; pre-migration reset tokens fail; legacy grants cannot authenticate. Tests also restore residual credentials deliberately and verify the defensive checks still reject them. The verified-Clerk provisioning boundary was exercised through its repository operation; a real external Clerk login was not performed.

### SEC-02 — Medium: unbounded frontend API request buffering

The frontend API proxy read the entire incoming body with `arrayBuffer()` before forwarding it. The API's parser limits therefore did not bound frontend memory use, including for unauthenticated requests.

Changes: read bodies incrementally, enforce a 5 MiB ceiling, check declared length early, and enforce the same ceiling when Content-Length is missing or understated. Oversized requests return 413 before token lookup or upstream forwarding. The limit preserves the existing maximum image upload size.

Verified: over-limit declared and chunked bodies are rejected; the stream is cancelled after crossing the ceiling; exactly 5 MiB of upload bytes is preserved; bodyless requests still work. These are stream-level tests, not a sustained load test of production infrastructure.

### SEC-03 — Low: malformed Clerk cookies caused internal errors

`decodeURIComponent()` on a malformed `__session` cookie threw an uncaught URIError. A request such as `Cookie: __session=%E0%A4%A` produced an internal error instead of a normal unauthenticated result.

Changes: reject malformed cookie encoding without throwing and retain rejection of duplicate session cookies.

Verified: malformed encodings do not throw, and an HTTP authentication request with the malformed cookie returns 401.

### SEC-04 — Medium availability issue: simultaneous webhook retries could fail

The infrastructure suite reproduced a unique-constraint error when simultaneous copies of an Instagram comment used Prisma's empty-update upsert. Deduplication prevented duplicate rows, but one delivery failed and could cause further provider retries.

Changes: use PostgreSQL conflict-safe insertion through `createMany({ skipDuplicates: true })`.

Verified: ten simultaneous copies delivered through two service instances retain one durable event; concurrent workers send one reply; a subsequent replay does not send another reply. This is a replay/availability fix; no forged webhook signature bypass was found.

### DEP-01 — Known vulnerable dependencies updated

Updated Next.js and its matching ESLint configuration, Sentry, Sharp, and Zod. Added constrained workspace overrides for affected transitive versions of PostCSS, Sharp, proxy-addr, body-parser, multer, fast-uri, brace-expansion, source-map-js, qs, mysql2, and js-yaml.

Examples of initial critical advisory matches:

- [Next.js image optimization advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw)
- [Sentry tunnel middleware advisory](https://github.com/advisories/GHSA-mchm-gjx6-7h55)
- [proxy-addr trust-subnet advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)

The package audit no longer reports those matches. No exploit payload for remote code execution was executed. The Sharp update required using its current exported Metadata type; image-upload integration tests pass with the updated library.

## Coverage and evidence

| Area | Evidence and limits |
| --- | --- |
| Authentication | Real HTTP checks for missing, expired, revoked, malformed, and suspended-user sessions; password hashing and reset token single use; Clerk migration regression. Real Clerk MFA and session-management UI not exercised. |
| Authorization / IDOR | Two-account HTTP attempts against pages, blocks, forms, audience contacts and notes, media upload intents, social media/disconnect, and short-link edits/statistics. Foreign records are concealed and unchanged. |
| Admin permissions | Anonymous requests return 401; ordinary users receive 403; persisted staff/admin roles and moderation behavior are tested. |
| CSRF / CORS | Missing mutation header and untrusted Origin rejection; exact allowed-origin responses; signed public webhook exceptions. |
| Premium enforcement | Free-account HTTP attempts against routing, advanced analytics, and export; owner scoping and persisted entitlement checks for background social jobs. Real checkout and billing-provider delivery not exercised. |
| Injection / mass assignment | Strict schemas reject server-controlled identity/owner/role fields and unsafe shapes; source review found parameterized SQL and React text rendering. No browser-executed stored-XSS payload or exhaustive SQL fuzzing was performed. |
| Redirects / SSRF | URL schemas reject dangerous protocols, credentials, whitespace, backslashes, and control characters. Destination links redirect the visitor; the API does not fetch those user-provided destinations. Provider API origins and redirect rejection reviewed. Short-link loop checks tested. No cloud-metadata probe was sent. |
| Media | Real upload tests cover owner binding, invalid bytes/types/dimensions, size checks, and in-use protection; public route IDs are validated. Live R2 bucket policies and presigned upload behavior were not tested. |
| Webhooks / OAuth | Forged Clerk and Meta events rejected; HMAC body binding, OAuth state/browser/provider binding, single use, PKCE where implemented, token encryption/tampering, and concurrent comment replays tested with fixtures. No actual provider authorization was completed. |
| Forms / audience | Invalid/unknown submitted fields rejected; cross-account reads/writes rejected; pausing a form blocks new public submissions. Export ownership and formula escaping covered by existing tests. |
| Rate limits / outages | Distributed Redis limits, Retry-After, spoofed X-Forwarded-For not bypassing the socket-IP limit, dependency failures, recovery, and fail-closed behavior tested. No destructive saturation or large-scale DoS test. |
| Configuration / secrets | Production configuration validation and sensitive error handling tested; environment examples are tracked while real env files are ignored. Pattern scan covered common private keys, Clerk secrets, AWS access-key IDs, and GitHub tokens. No git-history or general entropy scan. |
| Frontend headers | Built frontend returned a signed-out dashboard redirect with CSP, DENY framing, nosniff, referrer policy, and permissions policy. Full page/browser checks were not completed; see limitations below. |

## Remaining findings and deployment review

### OPEN-01 — High package advisory: Prisma configuration dependency

`@prisma/client > prisma > @prisma/config > deepmerge-ts@7.1.5` still matches [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). The fix is in deepmerge-ts 8.0.0, which includes breaking behavior changes.

The advisory requires merging recursive JavaScript object graphs; plain JSON does not create that condition. Kachko's Prisma configuration uses a local configuration object, and no HTTP input path to this merge was identified. This is a remaining dependency finding, not a demonstrated remote exploit of Kachko.

Follow-up: upgrade Prisma to a compatible supported release carrying the fix, or validate a narrowly scoped deepmerge-ts 8 override against Prisma configuration and migration workflows. No blind major-version override was applied.

### OPEN-02 — Conditional medium: rate-limit buckets behind the frontend proxy

IdentityRateGuard keys limits by the API socket IP. In a deployment where every browser request arrives through the same frontend proxy, visitors can share a bucket. An abusive visitor could exhaust a shared bucket and deny legitimate requests. Source review establishes this architecture risk; it was not reproduced across independent clients in the production deployment.

Follow-up: test separate clients in staging, then enforce per-client limits at the trusted ingress or configure verified proxy-aware identity. Do not fix this by accepting arbitrary client-supplied X-Forwarded-For headers.

### OPEN-03 — Provider lifecycle gap: out-of-band Clerk deletion

The current verified Clerk webhook handler reconciles subscription events and does not handle `user.deleted`. App-initiated deletion deletes application data directly, but deletion performed outside Kachko needs a separate synchronization path to disable public content and queued work. This is a source-review finding; real Clerk-dashboard deletion was not exercised.

Follow-up: implement and subscribe to verified deletion events, choose the application-data retention policy, and test that out-of-band deletion stops public pages, short links, and social jobs.

## Limits and staging work

The local production frontend started and returned authentication redirects and security headers. Its landing-page probe subsequently failed with local `getaddrinfo ENOTFOUND localhost` and EMFILE errors. The temporary frontend was stopped. That response was not accepted as a successful page/security test, and no authenticated browser pentest is claimed.

Still required on a reachable staging deployment with disposable users:

1. Real Clerk sign-in, MFA, session revocation, billing transitions, and signed webhook delivery.
2. Browser testing of stored text/form payloads, CSP enforcement, and middleware bypass variants.
3. TLS, HSTS, CDN cache behavior, trusted forwarding headers, and per-client rate isolation.
4. Live R2 upload/bucket permissions and storage cleanup.
5. Meta/Google OAuth permissions, revoked grants, real callback signatures, and controlled DM delivery.
6. Out-of-band Clerk deletion and provider data-deletion lifecycle.
7. Bounded staging concurrency/load checks after setting service resource budgets.

No production hostname was provided. Linktree was not used as a penetration-test target.

## Re-run checks

From the repository root:

```bash
pnpm --filter api test
pnpm --filter kachko-fe test
pnpm --filter api test:infra
pnpm --filter api lint
pnpm --filter kachko-fe lint
pnpm --filter kachko-fe build
pnpm audit --prod
git diff --check
```

The infrastructure suite requires Docker and creates/removes its own temporary containers with disposable data. It does not use the developer's application database. `pnpm audit --prod` currently exits nonzero because OPEN-01 remains.

During this assessment, three stale integration assertions were updated to match server-generated request IDs, billing-aware cache keys, and the current 12-theme catalog. These were test maintenance changes, separate from the security fixes.
