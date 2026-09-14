# kachko — Google login

Google login is now part of the current identity milestone, alongside email/password. Rohan owns the API and Google Cloud configuration; Girish owns the Google button, callback UI and username form. Other providers and account linking remain later work.

## Google Cloud configuration

Follow Google's [web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server) and [OpenID Connect guide](https://developers.google.com/identity/openid-connect/openid-connect).

1. Create/select your Google Cloud project and configure the Google Auth consent screen (branding, audience and contact information).
2. Create an OAuth client of type **Web application**. Use the client ID and client secret, not an API key or service account.
3. Add this exact authorized redirect URI for local testing: `http://localhost:4000/api/v1/auth/google/callback`.
4. If the consent app is in testing mode, add the Google accounts you will test with as test users.
5. Put the values in `apps/api/.env` (never in a NEXT_PUBLIC variable, browser bundle, root Compose config or committed file):

```dotenv
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/v1/auth/google/callback
# Leave empty for API-only local tests; callback displays JSON.
GOOGLE_LOGIN_REDIRECT_URL=
CORS_ORIGINS=http://localhost:3000,http://localhost:4000
```

Both client values may be empty to disable Google while keeping password login available. Partial credentials fail environment validation. Production redirect URLs must be HTTPS. The optional frontend redirect must have an origin in CORS_ORIGINS and contain no query, fragment or embedded credentials. No request-controlled return URL is accepted.

Apply the new additive GoogleAccount migration and restart:

```bash
pnpm db:deploy
pnpm dev
```

Root DATABASE_URL must target the same database as apps/api/.env. PostgreSQL and Redis must be running. If the API port changes, update GOOGLE_REDIRECT_URI, the Google Cloud authorized redirect URI, and the Swagger origin in CORS_ORIGINS.

## Endpoints

All paths below use `http://localhost:4000/api/v1` locally.

| Method | Path | Behavior |
|---|---|---|
| GET | `/auth/google` | Browser navigation; sets state cookie and redirects to Google |
| GET | `/auth/google/callback` | Google-only callback; validates state/code, then logs in or requests onboarding |
| GET | `/auth/google/pending` | Returns `{data:{email}}` for a valid pending onboarding cookie |
| POST | `/auth/google/complete` | Accepts `{username,displayName?}`; creates user + Google link + session atomically; returns 201 `{data:IdentityUser}` |

POST complete requires `X-Kachko-CSRF: 1`, JSON, and the pending cookie. Email, Google subject, roles and tokens cannot be supplied in the body. Username validation is shared with password registration. No account exists until username completion succeeds. The pending cookie never authenticates protected API routes.

With no frontend redirect configured, callback returns one of:

```json
{"data":{"onboardingRequired":true}}
```

or `{data:{onboardingRequired:false,user:IdentityUser}}`, with the ordinary kachko session cookie. After login, use the existing `/auth/me`, `/users/me`, `/users/me` PATCH and `/auth/logout` endpoints.

## Browser test without frontend changes

1. Open **http://localhost:4000/api/v1/auth/google** directly in a browser tab. Do not use Swagger Execute or fetch for this step: it is a browser redirect flow.
2. Choose a Google account and approve consent.
3. For a new user, the callback displays `onboardingRequired: true` and sets an HTTP-only pending cookie, valid for 10 minutes.
4. In the **same browser**, open **http://localhost:4000/api/docs**, execute `POST /api/v1/auth/google/complete` with header `X-Kachko-CSRF: 1` and body:

```json
{"username":"rohan_google","displayName":"Rohan"}
```

5. Expect 201 and the session cookie. Open **http://localhost:4000/api/v1/auth/me** to verify it. The browser sends cookies automatically; curl/Postman do not share browser cookies.
6. Execute `POST /api/v1/auth/logout` from Swagger with the CSRF header; `/auth/me` should then return 401.
7. Open `/api/v1/auth/google` again and use the same Google account: it logs into the same kachko user without another username step.

If that email already belongs to a password account, expect 409 `ACCOUNT_LINK_REQUIRED`. Sign in with the existing method. This feature deliberately does not merge accounts by email or link a Google identity based only on an already-present session. Explicit account linking will need a separate authenticated confirmation flow. For a new-user test, use a Google account whose email is not already registered in the development database.

## Girish's integration

Use browser navigation (an anchor or `window.location.assign`) to the API `/auth/google` URL. Once the frontend callback page exists, set:

```dotenv
GOOGLE_LOGIN_REDIRECT_URL=http://localhost:3000/auth/google/callback
```

The API redirects there with `?status=onboarding` or `?status=authenticated`. These values are UI hints only: verify them through `/auth/google/pending` or `/auth/me`. The callback URL contains no kachko session token or pending credential. For onboarding, show the shared username form, then POST complete with `credentials: 'include'` and the CSRF header. For returning users, fetch `/auth/me` and enter the dashboard. Errors currently render the standard JSON error envelope at the API callback, rather than redirecting error details to the FE.

As with password sessions, production frontend/API must be same-site HTTPS origins for SameSite=Lax cookies. No frontend files have been changed; the shared contracts and API are ready for integration.

## Security and data

- Authorization-code flow uses PKCE S256, a random state bound to an HTTP-only cookie, and nonce verification.
- Redis stores hashed state/pending keys for 10 minutes. State is consumed atomically before code exchange; onboarding grants are consumed atomically before account creation. Missing, expired, mismatched or reused state is rejected. Validation errors preserve the pending grant; DB conflicts require restarting Google sign-in after choosing another username.
- Google's official `google-auth-library` verifies ID-token signature, issuer, audience and expiry. The API also requires the expected nonce, a verified valid email and a nonempty Google subject.
- Google subject is the stable login key in `GoogleAccount`, unique and linked to one User. Email changes at Google do not change the linked user or silently rewrite the kachko email.
- New Google users have passwordHash=null and isVerified=true. They use the same session expiry/revocation and inactive/deleted-user checks as password users.
- Provider tokens and Google avatar URLs are neither stored nor returned. Profile display name is user-supplied during onboarding; avatars remain part of the media feature.
- Provider exchange/verification requests have a five-second per-request timeout and sanitized errors. State/pending operations use the dependency timeout and fail closed on Redis outage.
- Rate limits: Google start 10/min/IP, callback 20/min/IP, complete 3/hour/IP; pending uses the shared identity limit. Browser return callbacks use state verification instead of requiring the mutation CSRF header.

Additional error codes: 503 GOOGLE_NOT_CONFIGURED; 401 GOOGLE_AUTH_FAILED or GOOGLE_ONBOARDING_EXPIRED; 403 GOOGLE_STATE_INVALID; 409 ACCOUNT_LINK_REQUIRED or ACCOUNT_UNAVAILABLE. Existing validation/CSRF/rate-limit errors still apply.

## Verification

`pnpm --filter api test` covers Google configuration and rejection of invalid provider claims. `pnpm --filter api test:auth` applies both migrations to isolated PostgreSQL and uses real Redis/HTTP/session flows with only the Google exchange mocked. It covers onboarding, no account before username, single-use state/grants, expiry, callback denial, email collision, repeated Google login, logout and inactive-user rejection, as well as the password-login regression journey. Live consent and Google credentials must be verified manually using the browser steps above.
