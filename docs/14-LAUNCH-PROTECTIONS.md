# Launch protections

Password recovery, public abuse reporting, role-protected moderation, audit logs, account suspension and permanent account deletion are implemented.

## Required deployment configuration

The API logs password-reset links locally when `RESEND_API_KEY` is empty. Production startup requires all three values:

```env
PUBLIC_APP_URL=https://kachko.app
RESEND_API_KEY=re_...
EMAIL_FROM=KACHKO <no-reply@kachko.app>
```

`PASSWORD_RESET_TTL_SECONDS` defaults to one hour and is bounded to 5 minutes–24 hours. The frontend also requires `NEXT_PUBLIC_APP_URL=https://kachko.app` so canonical, Open Graph, share, and QR destinations use the same `/@username` URL.

Apply the new database migration before deployment:

```sh
pnpm db:deploy
```

## Password reset

- `POST /api/v1/auth/password-reset/request` accepts `{ "email": "user@example.com" }` and always returns `202 {data:{accepted:true}}` to prevent account enumeration.
- `POST /api/v1/auth/password-reset/confirm` accepts `{ "token": "...", "password": "at-least-12-characters" }`.
- Tokens are random, stored only as SHA-256 digests, expire after the configured TTL, and are consumed atomically once.
- A successful reset revokes every existing session and invalidates all other reset tokens for that account.

## Reports and moderation

- `POST /api/v1/moderation/reports` is public, CSRF-protected, rate-limited to five reports/hour/source, and accepts a published `pageId`, a reason, and optional 10–2000 character details.
- `GET /api/v1/moderation/reports?status=OPEN` and `POST /api/v1/moderation/reports/:id/status` require a `MODERATOR` or `ADMIN` session.
- `PATCH /api/v1/moderation/users/:id/status` and `GET /api/v1/moderation/audit-logs` require `ADMIN`.
- Suspending an account revokes active sessions, unpublishes its page, and increments its page revision. Public visibility is still checked against PostgreSQL on every request, so a warm Redis entry cannot bypass suspension.
- Privileged report and user-status changes write immutable audit rows.

Promote the first administrator deliberately through a controlled database operation; there is no public role-changing endpoint.

## Account deletion

`DELETE /api/v1/users/me` accepts `{ "confirmation": "DELETE", "password": "..." }`. Password is required for password-based accounts; a valid authenticated session and the exact confirmation are required for Google-only accounts. The operation permanently deletes relational account data, sessions, pages, blocks, analytics, and media metadata, then best-effort deletes stored media objects and clears the session cookie.

## Checks

```sh
pnpm test
pnpm --filter api test:auth
pnpm --filter api test:pages
```

The integration checks use isolated temporary PostgreSQL and Redis containers and exercise single-use reset tokens, session revocation, staff/admin role gates, reports, suspension, audit records, and deletion.
