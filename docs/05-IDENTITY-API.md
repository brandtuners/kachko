# kachko — Identity API and local testing

Google signup/login is also implemented; see [Google setup and browser testing](06-GOOGLE-LOGIN.md).

Implemented backend scope: registration, login/logout, persistent cookie sessions, username availability, and own-profile reads/updates. Rohan owns the API; Girish uses the shared contracts and verifies the browser integration. The blueprint's identity integration gate remains open until the real frontend journey is verified.

## Start locally

Run from the repository root. Keep existing `.env` files; create missing files from `.env.example` and `apps/api/.env.example`. The root file configures Compose/Prisma CLI; `apps/api/.env` configures the running API. Both DATABASE_URL values must point to the same database. Redis must match the running service.

```bash
pnpm install
docker compose up -d --wait postgres redis
pnpm db:deploy
pnpm dev
```

API base: `http://localhost:4000/api/v1`. Swagger: `http://localhost:4000/api/docs` (development only). Readiness: `GET /api/v1/health/ready`; both services should be `up`. Health does not verify migrations, so run `db:deploy` before auth tests.

## Endpoint contract

| Method | Path under `/api/v1` | Session | Success |
|---|---|---|---|
| POST | `/auth/register` | No; creates session | 201 `{data: IdentityUser}` |
| POST | `/auth/login` | No; creates session | 200 `{data: IdentityUser}` |
| GET | `/auth/me` | Required | 200 `{data: IdentityUser}` |
| POST | `/auth/logout` | Optional; revokes supplied session | 200 `{data:{loggedOut:true}}` |
| GET | `/users/me` | Required | 200 `{data: IdentityUser}` |
| PATCH | `/users/me` | Required | 200 `{data: IdentityUser}` |
| GET | `/users/username/:username` | No | 200 `{data:{username,available,reason?}}` |

IdentityUser contains exactly `id`, `email`, `username`, `displayName`, `bio`, `avatarUrl`. The last three can be null. No hashes, session tokens, database flags or roles are exposed. All identity responses use `Cache-Control: no-store`.

Register JSON: required `email`, `password`, `username`; optional `displayName`. Login JSON: required `email`, `password`. Profile PATCH accepts only `displayName`, `bio`, `username`, with at least one field. Unknown fields are rejected, including `id`, `userId`, `email`, `role` and `avatarUrl`. The authenticated session selects the user being updated.

Shared browser-safe packages:

- `@kachko/types`: response and error types.
- `@kachko/validation`: Zod request schemas, inferred input types, username rules and reserved-name seed data.

API build/dev/typecheck compile these packages automatically. After editing shared contract sources during development, restart `pnpm dev` to rebuild and reload them. Girish should add the required workspace dependencies to the frontend when integrating.

Rules: email is trimmed/lowercased and limited to 254 characters; usernames are trimmed/lowercased, 3–30 characters from `a-z`, `0-9`, `_`, `-`, `.`. Reserved names are the version-controlled `RESERVED_USERNAMES` constant in `packages/validation/src/index.ts`; no dummy accounts or reserved-name DB table are necessary. Availability returns `reason: "reserved"` or `"taken"`; malformed usernames return 400. Availability is advisory; database uniqueness remains authoritative during registration/update.

New passwords are 12–128 characters and are never trimmed. Login accepts 1–128 characters and returns a generic failure for invalid credentials. Display name is 1–80 trimmed characters (null clears it on update). Bio is at most 500 trimmed characters (null clears it). Avatar changes require the future media ownership/upload-completion flow. No arbitrary avatar URLs are accepted.

Username updates currently change User only: Page does not exist yet. When Page is added, slug synchronization and old/new public cache invalidation must be added transactionally before page publishing ships. The separate LLD `PATCH /users/me/username` example is consolidated into the blueprint's `PATCH /users/me` endpoint.

## Cookies, CSRF and rate limits

For local Swagger testing, set `CORS_ORIGINS=http://localhost:3000,http://localhost:4000` in `apps/api/.env` and restart the API. Swagger sends the API origin (`http://localhost:4000`) even though its generated curl example may omit the browser-added Origin header. If PORT changes, update this origin too. Production should list only intended application origins.

Every POST/PATCH requires `X-Kachko-CSRF: 1`, including registration/login/logout. A supplied Origin must exactly match `CORS_ORIGINS`. This implements the [OWASP custom-header approach for API requests](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#employing-custom-request-headers-for-ajaxapi): browsers must pass CORS preflight before sending the header. It is a fixed required header, not a secret or a token-fetch endpoint. Non-browser tools such as curl may omit Origin but still require the header. CORS allows Content-Type and X-Kachko-CSRF and exposes Retry-After.

Girish's client must use `credentials: 'include'` and send this header on mutations. The session cookie is HTTP-only; frontend code must not read/store it. Local FE/API should both use `localhost` (not one `localhost` and one `127.0.0.1`). Production FE/API must be same-site HTTPS origins, for example `app.kachko.app` and `api.kachko.app`; unrelated Vercel/Azure domains will not work with SameSite=Lax. Their origins must also be in CORS_ORIGINS.

`SESSION_COOKIE_NAME=kachko_session`; `SESSION_TTL_SECONDS=604800` (7 days, configurable 60 seconds–30 days). Cookies are host-only, Path `/api/v1`, SameSite=Lax, HttpOnly, and Secure in production. Changing the API prefix also requires updating cookie Path in `identity.controller.ts`. There is no sliding refresh. Each login/register uses a fresh random 256-bit token; only its SHA-256 digest is stored. A previously supplied valid-format cookie's session is revoked atomically when login/register succeeds. Other devices retain their own sessions. Logout revokes the supplied session; repeated logout is safe. Expired/revoked sessions and inactive/deleted users are rejected. Last-used timestamps are updated at most once a minute per session.

Passwords use Argon2id (19 MiB, two passes, one lane). Redis uses atomic counters with expiry: registration 3/hour/IP, login 5/minute/IP, username checks 60/minute/IP, remaining identity routes share 60/minute/IP. Invalid attempts count. 429 includes Retry-After seconds. Redis outage fails closed with 503. The API currently uses the socket IP and does not trust X-Forwarded-For; configure a narrowly trusted deployment proxy before using per-client limits behind a reverse proxy. Never enable blanket proxy trust. Expired-session cleanup and password reset remain launch-protection work.

Error envelope: `{error:{code,message}}`.

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid, empty or unknown input fields |
| 401 | `INVALID_CREDENTIALS` | Login failed (same message for unknown/inactive/deleted accounts) |
| 401 | `UNAUTHENTICATED` | Missing, malformed, expired or revoked session |
| 403 | `CSRF_REJECTED` | Missing header or unapproved Origin |
| 409 | `ACCOUNT_UNAVAILABLE` | Registration email or username unavailable |
| 409 | `USERNAME_UNAVAILABLE` | Profile username already taken |
| 429 | `RATE_LIMITED` | Wait Retry-After before retrying |
| 503 | `DEPENDENCIES_UNAVAILABLE` | Rate-limit service unavailable |

Unexpected database errors use the existing sanitized 500 envelope. Check readiness and migration status when diagnosing database failures.

## Copyable local test flow

Run these commands in the same terminal. The cookie file is created outside the repository with restrictive permissions. Example passwords/accounts are for local development only. Choose a new email/username if you have already registered them. Use curl `-i` to see status and cookie headers; Postman can use the same URLs, JSON bodies and header and will keep cookies automatically.

```bash
API=http://localhost:4000/api/v1
COOKIE_JAR=$(mktemp -t kachko-cookies)

# 1. Dependencies and username availability: expect 200.
curl -i "$API/health/ready"
curl -i "$API/users/username/rohan_dev"

# 2. Register: expect 201 plus Set-Cookie.
curl -i -c "$COOKIE_JAR" "$API/auth/register" \
  -H 'Content-Type: application/json' \
  -H 'X-Kachko-CSRF: 1' \
  -d '{"email":"rohan.local@example.com","username":"rohan_dev","password":"Local-test-password-123!","displayName":"Rohan"}'

# 3. Read session and profile: expect 200.
curl -i -b "$COOKIE_JAR" "$API/auth/me"
curl -i -b "$COOKIE_JAR" "$API/users/me"

# 4. Edit your profile: expect 200 with updated fields.
curl -i -b "$COOKIE_JAR" -X PATCH "$API/users/me" \
  -H 'Content-Type: application/json' \
  -H 'X-Kachko-CSRF: 1' \
  -d '{"displayName":"Rohan Dev","bio":"Building kachko","username":"rohan.dev"}'

# 5. Log out: expect 200 and cookie removal.
curl -i -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$API/auth/logout" \
  -H 'X-Kachko-CSRF: 1'

# 6. Session is gone: expect 401.
curl -i -b "$COOKIE_JAR" "$API/auth/me"

# 7. Log in again: expect 200 and a new cookie.
curl -i -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -H 'X-Kachko-CSRF: 1' \
  -d '{"email":"rohan.local@example.com","password":"Local-test-password-123!"}'

# 8. Session works again: expect 200.
curl -i -b "$COOKIE_JAR" "$API/auth/me"

# 9. End the test session and remove its local cookie file.
curl -i -b "$COOKIE_JAR" -X POST "$API/auth/logout" -H 'X-Kachko-CSRF: 1'
rm "$COOKIE_JAR"
```

Negative checks: omit X-Kachko-CSRF on a mutation (403); send an unapproved Origin (403); register a reserved username (400); reuse an email/username (409); use the wrong password (401); add `role` to a profile PATCH (400). Registration has a strict 3-attempt/hour limit, including failed validation. Wait for the limit to expire rather than repeatedly registering; login suffices for an existing account. Automated tests use isolated Redis and do not consume your development limits.

## Automated verification

```bash
pnpm --filter api typecheck
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:auth
```

`test:auth` requires Docker and starts uniquely named temporary PostgreSQL/Redis containers with random host ports, applies the migration, then removes only those containers. It checks normalization, validation, safe responses, password/token hashing, session persistence across restart, duplicate registration races, profile ownership, cookie rotation/logout, expiry, disabled/deleted users, CSRF, and real Redis rate limits/outage behavior. The frontend/browser integration remains for Rohan and Girish to verify together.
