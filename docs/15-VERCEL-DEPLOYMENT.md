# Vercel deployment runbook

KACHKO deploys as two Vercel projects from this pnpm/Turborepo monorepo:

| Project | Root Directory | Framework | Domain |
|---|---|---|---|
| `kachko-fe` | `apps/kachko-fe` | Next.js | `kachko.app` / `staging.kachko.app` |
| `kachko-api` | `apps/api` | NestJS | `api.kachko.app` / `api-staging.kachko.app` |

The repository currently has a `dev` branch. Either create/protect `main` as the production branch, or set both Vercel projects’ Production Branch to `dev` until that branch is introduced; use a separate `staging` branch for Preview deployments.

Vercel's Development, Preview and Production environments map to local development, staging and production. Preview is the staging environment on Hobby; Pro/Enterprise can create a custom `staging` environment. See [Vercel environments](https://vercel.com/docs/deployments/environments) and [environment variables](https://vercel.com/docs/environment-variables).

## 1. Create isolated infrastructure

Create separate resources for every environment:

- PostgreSQL: one development, staging and production database (Neon, Supabase, or equivalent). Use the provider's pooled/SSL URL.
- Redis: one development, staging and production database/instance suitable for serverless access (Upstash is a common option).
- Cloudflare R2: separate buckets or strictly isolated prefixes. Vercel disk is ephemeral, so staging/production must use `MEDIA_STORAGE=r2`.
- Resend: verified sending domain and separate keys/senders for staging and production.
- Google OAuth: environment-specific client IDs/secrets and exact callback URLs.

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
GOOGLE_CLIENT_ID=<local client id>
GOOGLE_CLIENT_SECRET=<local secret>
GOOGLE_REDIRECT_URI=http://localhost:4000/api/v1/auth/google/callback
GOOGLE_LOGIN_REDIRECT_URL=http://localhost:3000/auth/google/callback
MEDIA_STORAGE=local
MEDIA_LOCAL_DIR=./tmp/media
```

### Staging / Preview

```env
NODE_ENV=production
CORS_ORIGINS=https://staging.kachko.app
DATABASE_URL=<staging pooled PostgreSQL URL>
REDIS_URL=<staging Redis URL>
DEPENDENCY_TIMEOUT_MS=2000
SESSION_COOKIE_NAME=kachko_session
SESSION_TTL_SECONDS=604800
PASSWORD_RESET_TTL_SECONDS=3600
PUBLIC_APP_URL=https://staging.kachko.app
RESEND_API_KEY=<staging Resend key>
EMAIL_FROM=KACHKO Staging <no-reply@staging.kachko.app>
ANALYTICS_HASH_SALT=<different staging salt, 32+ characters>
GOOGLE_CLIENT_ID=<staging client id>
GOOGLE_CLIENT_SECRET=<staging secret>
GOOGLE_REDIRECT_URI=https://api-staging.kachko.app/api/v1/auth/google/callback
GOOGLE_LOGIN_REDIRECT_URL=https://staging.kachko.app/auth/google/callback
MEDIA_STORAGE=r2
R2_ACCOUNT_ID=<account id>
R2_ACCESS_KEY_ID=<staging key>
R2_SECRET_ACCESS_KEY=<staging secret>
R2_BUCKET=<staging bucket>
R2_PUBLIC_URL=https://cdn-staging.kachko.app
```

### Production

Use production resources and domains for the staging set:

```env
NODE_ENV=production
CORS_ORIGINS=https://kachko.app
DATABASE_URL=<production pooled PostgreSQL URL>
REDIS_URL=<production Redis URL>
PUBLIC_APP_URL=https://kachko.app
RESEND_API_KEY=<production Resend key>
EMAIL_FROM=KACHKO <no-reply@kachko.app>
ANALYTICS_HASH_SALT=<different production salt, 32+ characters>
GOOGLE_REDIRECT_URI=https://api.kachko.app/api/v1/auth/google/callback
GOOGLE_LOGIN_REDIRECT_URL=https://kachko.app/auth/google/callback
MEDIA_STORAGE=r2
R2_BUCKET=<production bucket>
R2_PUBLIC_URL=https://cdn.kachko.app
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
NEXT_PUBLIC_CDN_URL=
NEXT_PUBLIC_SENTRY_DSN=

# Staging / Preview
NEXT_PUBLIC_APP_URL=https://staging.kachko.app
API_URL=https://api-staging.kachko.app
NEXT_PUBLIC_CDN_URL=https://cdn-staging.kachko.app

# Production
NEXT_PUBLIC_APP_URL=https://kachko.app
API_URL=https://api.kachko.app
NEXT_PUBLIC_CDN_URL=https://cdn.kachko.app
```

The Next.js rewrite sends browser `/api/v1/*` calls to the API while keeping cookies and CSRF requests same-origin from the browser.

## 6. Domains and OAuth

Add these domains in Vercel and configure DNS/TLS:

```text
FE:  kachko.app, staging.kachko.app
API: api.kachko.app, api-staging.kachko.app
```

Assign the staging hostnames to the `staging` branch (or your custom staging environment) in Vercel’s Domains settings. Otherwise a Preview deployment may receive a generated URL while `API_URL` still points at the previous deployment.

In Google Cloud Console, add these exact authorized redirect URIs:

```text
http://localhost:4000/api/v1/auth/google/callback
https://api-staging.kachko.app/api/v1/auth/google/callback
https://api.kachko.app/api/v1/auth/google/callback
```

Use matching `GOOGLE_LOGIN_REDIRECT_URL` values for each environment.

## 7. Migrate each database

Run from a trusted machine after checking the target URL:

```sh
DATABASE_URL='<staging URL>' pnpm db:deploy
DATABASE_URL='<production URL>' pnpm db:deploy
```

Never run `prisma migrate dev` or accept a reset against staging/production. The current migrations include identity, pages, media, analytics and launch-protection tables.

## 8. Deploy and verify staging

Push a `staging` branch. Vercel creates Preview deployments. Verify the FE Preview points to `api-staging.kachko.app`.

Run this checklist against staging:

1. `/api/v1/health/live` returns 200.
2. `/api/v1/health/ready` returns 200.
3. Register → create page → add link → publish → open `/@username`.
4. Edit profile, theme and social links; reload and confirm persistence.
5. Upload avatar/IMAGE through R2.
6. Generate/download QR and open it on a phone.
7. Inspect canonical, Open Graph and Twitter metadata.
8. Verify analytics totals and owner-only access.
9. Test password reset email, expiry, replay rejection and session revocation.
10. Test Google signup, existing-account linking and repeat Google login.
11. Submit a report, resolve it as admin, suspend a disposable user, and verify their public page becomes 404.
12. Delete a disposable account and verify sessions, public visibility and media metadata are removed.

Check Vercel function logs, database metrics, Redis metrics and Resend delivery logs during this pass.

## 9. Deploy production and rollback

After staging passes, merge to `main` and push. Vercel creates the Production deployment. Alternatively deploy each linked project with:

```sh
vercel deploy --prod
```

Run the health and smoke checklist again. Use Vercel Instant Rollback if the deployment is faulty. Database changes are forward-only; maintain a tested restore plan and do not roll back application code across an incompatible migration.

## 10. Analytics retention

`prisma/analytics-retention.sql` is currently a CLI SQL command. Vercel Cron invokes an HTTP route, not a shell command. Before production, either schedule the SQL from a trusted database/CI scheduler or add a protected API cron route using `CRON_SECRET`, then register it in `vercel.json`. Never expose an unauthenticated prune endpoint. Vercel Cron runs only on production deployments; see [Vercel Cron documentation](https://vercel.com/docs/cron-jobs).

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
- [ ] HTTPS domains, CORS and credentialed cookies verified.
- [ ] Google redirects and Resend sender domain verified.
- [ ] All staging browser journeys pass.
- [ ] Production health, smoke tests and rollback procedure are ready.
- [ ] Analytics retention is scheduled through a protected job.
