# Vercel deployment runbook

KACHKO deploys as two Vercel projects from this pnpm/Turborepo monorepo:

| Project | Root Directory | Framework | Domain |
|---|---|---|---|
| `kachko-fe` | `apps/kachko-fe` | Next.js | `kachko.in` / `staging.kachko.in` |
| `kachko-api` | `apps/api` | NestJS | `api.kachko.in` / `api-staging.kachko.in` |

The repository currently has a `dev` branch. Either create/protect `main` as the production branch, or set both Vercel projects’ Production Branch to `dev` until that branch is introduced; use a separate `staging` branch for Preview deployments.

Vercel's Development, Preview and Production environments map to local development, staging and production. Preview is the staging environment on Hobby; Pro/Enterprise can create a custom `staging` environment. See [Vercel environments](https://vercel.com/docs/deployments/environments) and [environment variables](https://vercel.com/docs/environment-variables).

## 1. Create isolated infrastructure

Create separate resources for every environment:

- PostgreSQL: one development, staging and production database (Neon, Supabase, or equivalent). Use the provider's pooled/SSL URL.
- Redis: one development, staging and production database/instance suitable for serverless access (Upstash is a common option).
- Cloudflare R2: separate buckets or strictly isolated prefixes. Vercel disk is ephemeral, so staging/production must use `MEDIA_STORAGE=r2`.
- Resend: verified sending domain and separate keys/senders for staging and production.
- Clerk: isolated development and production instances. Configure Google as a
  Clerk social connection and use the redirect URI shown by Clerk.

Never point staging at production data.

## 2. Prepare the repository

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm db:validate
pnpm typecheck
pnpm lint
pnpm test
```

Commit source, contract and Prisma migration changes. Never commit `.env`, `.env.local`, database URLs, OAuth secrets, R2 credentials, Resend keys or Vercel tokens.

## 3. Create the API project

In Vercel → Add New → Project, import the repository and configure:

```text
Project Name: kachko-api
Root Directory: apps/api
Framework Preset: NestJS
Production Branch: main
```

Keep `apps/api/vercel.json`. `src/main.ts` is a recognized NestJS entrypoint and Vercel deploys it as one serverless function. See the [NestJS Vercel guide](https://vercel.com/kb/guide/ship-a-nestjs-app-on-vercel).

If workspace commands are not inferred, use:

```text
Install Command: pnpm install --frozen-lockfile
Build Command: cd ../.. && pnpm --filter api build
Output Directory: framework default
```

Link/deploy from `apps/api` if using the CLI:

```sh
vercel login
vercel link
vercel deploy
```

The first deploy is Preview. Use `vercel deploy --prod` only after staging verification.

## 4. API environment variables

Add each variable in Vercel Project Settings → Environment Variables and select its environment. Values below are examples; use real provider values.

### Development

```env
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000
DATABASE_URL=postgresql://...development...
REDIS_URL=redis://...development...
DEPENDENCY_TIMEOUT_MS=2000
SESSION_COOKIE_NAME=kachko_session
SESSION_TTL_SECONDS=604800
PASSWORD_RESET_TTL_SECONDS=3600
PUBLIC_APP_URL=http://localhost:3000
RESEND_API_KEY=
EMAIL_FROM=KACHKO <no-reply@example.com>
ANALYTICS_HASH_SALT=<32+ random characters>
CLERK_SECRET_KEY=<development Clerk secret key>
# GOOGLE_* is optional legacy direct-OAuth compatibility only.
MEDIA_STORAGE=local
MEDIA_LOCAL_DIR=./tmp/media
```

### Staging / Preview

```env
NODE_ENV=production
CORS_ORIGINS=https://staging.kachko.in
DATABASE_URL=<staging pooled PostgreSQL URL>
REDIS_URL=<staging Redis URL>
DEPENDENCY_TIMEOUT_MS=2000
SESSION_COOKIE_NAME=kachko_session
SESSION_TTL_SECONDS=604800
PASSWORD_RESET_TTL_SECONDS=3600
PUBLIC_APP_URL=https://staging.kachko.in
RESEND_API_KEY=<staging Resend key>
EMAIL_FROM=KACHKO Staging <no-reply@staging.kachko.in>
ANALYTICS_HASH_SALT=<different staging salt, 32+ characters>
CLERK_SECRET_KEY=<staging Clerk secret key>
MEDIA_STORAGE=r2
R2_ACCOUNT_ID=<account id>
R2_ACCESS_KEY_ID=<staging key>
R2_SECRET_ACCESS_KEY=<staging secret>
R2_BUCKET=<staging bucket>
R2_PUBLIC_URL=https://cdn-staging.kachko.in
```

### Production

Use production resources and domains for the staging set:

```env
NODE_ENV=production
CORS_ORIGINS=https://kachko.in
DATABASE_URL=<production pooled PostgreSQL URL>
REDIS_URL=<production Redis URL>
PUBLIC_APP_URL=https://kachko.in
RESEND_API_KEY=<production Resend key>
EMAIL_FROM=KACHKO <no-reply@kachko.in>
ANALYTICS_HASH_SALT=<different production salt, 32+ characters>
CLERK_SECRET_KEY=<production Clerk secret key>
MEDIA_STORAGE=r2
R2_BUCKET=<production bucket>
R2_PUBLIC_URL=https://cdn.kachko.in
```

Keep all credentials server-only. `PUBLIC_APP_URL` must be an exact HTTPS origin in production and must not have a trailing slash.

## 5. Create the frontend project

Import the same repository again:

```text
Project Name: kachko-fe
Root Directory: apps/kachko-fe
Framework Preset: Next.js
Production Branch: main
```

Recommended fallback settings:

```text
Install Command: pnpm install --frozen-lockfile
Build Command: cd ../.. && pnpm --filter kachko-fe build
Output Directory: framework default
```

Set FE variables per environment:

```env
# Development
NEXT_PUBLIC_APP_URL=http://localhost:3000
API_URL=http://localhost:4000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<development Clerk publishable key>
CLERK_SECRET_KEY=<development Clerk secret key>
NEXT_PUBLIC_CDN_URL=
NEXT_PUBLIC_SENTRY_DSN=

# Staging / Preview
NEXT_PUBLIC_APP_URL=https://staging.kachko.in
API_URL=https://api-staging.kachko.in
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<staging Clerk publishable key>
CLERK_SECRET_KEY=<staging Clerk secret key>
NEXT_PUBLIC_CDN_URL=https://cdn-staging.kachko.in

# Production
NEXT_PUBLIC_APP_URL=https://kachko.in
API_URL=https://api.kachko.in
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<production Clerk publishable key>
CLERK_SECRET_KEY=<production Clerk secret key>
NEXT_PUBLIC_CDN_URL=https://cdn.kachko.in
```

The Next.js App Router BFF handles browser `/api/v1/*` calls. It obtains the
Clerk session token server-side, sends it to Nest as a bearer token, and keeps
API and CSRF requests same-origin from the browser.

## 6. Domains and Clerk

Add these domains in Vercel and configure DNS/TLS:

```text
FE:  kachko.in, staging.kachko.in
API: api.kachko.in, api-staging.kachko.in
```

Assign the staging hostnames to the `staging` branch (or your custom staging environment) in Vercel’s Domains settings. Otherwise a Preview deployment may receive a generated URL while `API_URL` still points at the previous deployment.

Link the existing Clerk application; do not run `clerk init` again. Before the
first production deployment, run `pnpm dlx clerk@latest deploy` interactively
from a trusted terminal, configure the production domain in Clerk, and add the
Google OAuth redirect URI displayed by Clerk to the production Google client.
Development, Preview/staging, and Production must not share secret keys.

Add each frontend hostname as an authorized party by including its exact origin
in the API's `CORS_ORIGINS`. The Nest token verifier rejects a valid Clerk token
when its `azp` does not match this allowlist.

## 7. Migrate each database

Run from a trusted machine after checking the target URL:

```sh
DATABASE_URL='<staging URL>' pnpm db:deploy
DATABASE_URL='<production URL>' pnpm db:deploy
```

Never run `prisma migrate dev` or accept a reset against staging/production. The current migrations include identity, pages, media, analytics and launch-protection tables.

## 8. Deploy and verify staging

Push a `staging` branch. Vercel creates Preview deployments. Verify the FE Preview points to `api-staging.kachko.in`.

Run this checklist against staging:

1. `/api/v1/health/live` returns 200.
2. `/api/v1/health/ready` returns 200.
3. Clerk sign-up (including Google) → onboarding → create page → add link →
   publish → open `/username`.
4. Edit profile, theme and social links; reload and confirm persistence.
5. Upload avatar/IMAGE through R2.
6. Generate/download QR and open it on a phone.
7. Inspect canonical, Open Graph and Twitter metadata.
8. Verify analytics totals and owner-only access.
9. Test Clerk password recovery, session expiry/revocation, sign-out, and
   protected-route redirection.
10. Test Google sign-up, verified-email local-user linking, and repeat Google
    login through Clerk.
11. Submit a report, resolve it as admin, suspend a disposable user, and verify their public page becomes 404.
12. Delete a disposable account and verify sessions, public visibility and media metadata are removed.

Check Vercel function logs, database metrics, Redis metrics and Resend delivery logs during this pass.

## 9. Deploy production and rollback

After staging passes, merge to `main` and push. Vercel creates the Production deployment. Alternatively deploy each linked project with:

```sh
vercel deploy --prod
```

Run the health and smoke checklist again. Use Vercel Instant Rollback if the deployment is faulty. Database changes are forward-only; maintain a tested restore plan and do not roll back application code across an incompatible migration.

## 10. Analytics retention and backups

`.github/workflows/analytics-retention.yml` runs the 12-month pruning SQL daily
through a protected GitHub production environment. Configure a least-privileged
`DATABASE_URL` environment secret, require reviewers for manual dispatches, and
monitor failed scheduled runs. The job may also be replaced by a trusted
database-provider scheduler; never expose an unauthenticated prune endpoint.

Enable the PostgreSQL provider's automated point-in-time recovery and perform
the portable backup/restore drill in `docs/16-DATABASE-OPERATIONS.md` at least
quarterly. A backup is not considered verified until it has restored
successfully into an isolated database and passed schema and smoke checks.

## CLI environment helpers

```sh
vercel env ls
vercel env pull --environment=development
vercel env pull --environment=preview
vercel env run -e preview -- pnpm test
vercel deploy
vercel deploy --prod
```

Environment changes affect new deployments, so redeploy after changing variables. See the [Vercel CLI deployment guide](https://vercel.com/docs/projects/deploy-from-cli).

## Final release gate

- [ ] Two Vercel projects use the correct monorepo root directories.
- [ ] Development, Preview/staging and Production variables are isolated.
- [ ] Staging/production use managed PostgreSQL, Redis and R2.
- [ ] Migrations applied and recorded for the intended database.
- [ ] Clerk production instance, HTTPS domains, authorized parties, and BFF
      bearer-token forwarding verified.
- [ ] Clerk Google connection/redirect and Resend sender domain verified.
- [ ] All staging browser journeys pass.
- [ ] Production health, smoke tests and rollback procedure are ready.
- [ ] Analytics retention is scheduled through a protected job.
- [ ] Provider backups are enabled and a dated restore drill has passed.
