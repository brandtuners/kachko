# Kachko — Clerk authentication and Google sign-in

Kachko's browser authentication is provided by Clerk. The Next.js application
renders Clerk's sign-in/sign-up UI at `/login` and `/register`; Google is a
Clerk social connection, not a browser flow owned by the Nest API.

The linked Clerk application is `kachko`
(`app_3L90hLW2Iya0T5mY1RmP389jvsi`). Do not run `clerk init` again or create a
replacement application for this repository.

## Local configuration

Use pnpm because this repository declares pnpm as its package manager:

```bash
pnpm dlx clerk@latest auth login
pnpm dlx clerk@latest link --app app_3L90hLW2Iya0T5mY1RmP389jvsi
pnpm dlx clerk@latest env pull --file apps/kachko-fe/.env.local
pnpm dlx clerk@latest env pull --file apps/api/.env
pnpm dlx clerk@latest doctor --json
```

Skip `link` when the repository is already linked. `env pull` merges Clerk keys;
it must not replace the database, Redis, media, email, or other API variables.
Never commit either environment file or expose `CLERK_SECRET_KEY` to browser
code. The checked-in examples document variable names only.

Required values:

- Frontend: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.
- API: `CLERK_SECRET_KEY`.
- API `CORS_ORIGINS` must include the exact frontend origin because Nest verifies
  the Clerk token's authorized party (`azp`). Local development uses
  `http://localhost:3000`.

## Request flow

1. `<ClerkProvider>` owns the browser session and the `/login` and `/register`
   components.
2. Clerk middleware recognizes the session and protects `/dashboard`, `/admin`,
   and `/onboarding`.
3. Browser API calls stay same-origin at `/api/v1/*`.
4. The Next.js BFF route calls `await auth()`, obtains the current Clerk session
   token with `getToken()`, and forwards it to Nest as
   `Authorization: Bearer <token>`.
5. Nest verifies the token with `@clerk/backend`, including expiry/not-before
   and `authorizedParties`, then uses the JWT `sub` claim as the stable Clerk
   user ID.
6. On the first authenticated API request, Nest links an existing local user by
   verified email or creates a local user and stores `User.clerkUserId`.

The browser never stores a token in localStorage/sessionStorage and never sends
the Clerk secret key. Public API endpoints continue to work through the same BFF
without a bearer token.

## Google sign-in

Enable and configure Google in the selected Clerk application's Social
Connections settings. Development instances may use Clerk's development OAuth
configuration. Before production, claim/configure the application, create the
production instance with `pnpm dlx clerk@latest deploy`, and follow the redirect
URI shown by Clerk for the production Google OAuth client.

Do not configure Google to redirect to
`/api/v1/auth/google/callback` for the current frontend flow. Those Nest routes
and `GOOGLE_*` environment variables belong to the legacy direct-OAuth
implementation and are retained temporarily for backward compatibility and API
tests; the Clerk UI does not call them.

## Account lifecycle

- Clerk is the source of truth for browser sessions and sign-in methods.
- PostgreSQL remains the source of truth for Kachko profile, role, pages, media,
  analytics, and product data.
- Existing local users are linked only when Clerk supplies a verified matching
  email address.
- A generated username uses the Clerk username when present, otherwise the
  verified email prefix, with collision-safe suffixing.
- Suspending a local user makes Nest reject their otherwise valid Clerk token.
- Permanent account deletion deletes the Clerk user before deleting local
  application data.
- Dashboard/admin sign-out calls Clerk `signOut()`; the legacy API logout is
  only a compatibility cleanup.

## Local verification

```bash
docker compose up -d --wait postgres redis
pnpm db:deploy
pnpm dev
pnpm dlx clerk@latest doctor --json
```

Then:

1. Open `http://localhost:3000/register` and continue with Google.
2. Confirm the flow reaches `/onboarding` for a new account and `/dashboard` for
   a returning account.
3. In DevTools Network, confirm `GET /api/v1/pages` returns `200` after sign-in.
4. Reload `/dashboard`; the session should remain active.
5. Sign out and confirm `/dashboard` redirects to
   `/login?redirect_url=...` and protected API requests return `401`.
6. Run `pnpm --filter kachko-fe typecheck`, `pnpm --filter kachko-fe lint`,
   `pnpm --filter api typecheck`, and `pnpm --filter api lint`.

For production verification, use an isolated Clerk production instance and a
disposable account. Do not reuse development keys in Preview or Production.
