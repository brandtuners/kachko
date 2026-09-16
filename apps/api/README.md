# kachko API

NestJS modular monolith following `docs/01-HLD.md` and `docs/02-LLD.md`.

From the repository root:

```sh
pnpm install
pnpm --filter api dev
pnpm --filter api build
pnpm --filter api start
pnpm --filter api typecheck
pnpm --filter api lint
pnpm --filter api test
```

For local PostgreSQL/Redis startup and connection examples, follow the [root setup guide](../../README.md#local-postgresql-and-redis).

Copy `apps/api/.env.example` to `apps/api/.env`, or provide the equivalent environment variables. `DATABASE_URL` and `REDIS_URL` are required; if you already have an env file, add the missing values from the example. Workspace scripts run with the API directory as their working directory.

- Health: `http://localhost:4000/api/v1/health`
- Liveness: `http://localhost:4000/api/v1/health/live`
- Dependency readiness: `http://localhost:4000/api/v1/health/ready`
- OpenAPI UI: `http://localhost:4000/api/docs` (disabled in production)
- Success envelope: `{ "data": ... }`; errors: `{ "error": { "code": ..., "message": ... } }`.

The scaffold includes configuration validation, global request validation, CORS, Helmet, exception handling, and health routes. Nest uses its Express adapter internally; application code uses Nest modules/controllers/providers. Production requires an explicit comma-separated `CORS_ORIGINS` allowlist.

Basic analytics requires a server-only `ANALYTICS_HASH_SALT` of at least 32 characters. Apply migrations with `pnpm db:deploy` and schedule `pnpm db:analytics:prune` daily for the documented 12-month retention window. See `docs/13-ANALYTICS-API.md`.

The root Prisma schema and initial User/Session migration are implemented. API build/dev/typecheck generate the client under `src/generated/prisma`; only this workspace owns `@prisma/client` and `@prisma/adapter-pg` runtime dependencies. See the [Prisma setup and commands](../../README.md#prisma-and-identity-database). Import `DatabaseModule` into backend feature modules and inject `PrismaService`; it owns the shared client/pool. Import `RedisModule` and inject `RedisService` to reuse its `client`. Do not create a connection per request or import generated models into frontend bundles.

PostgreSQL and Redis connect during NestJS initialization and release their connections through application shutdown hooks. PostgreSQL startup failure is logged without connection details; subsequent readiness probes retry it. Redis connects/reconnects in the background, so a dependency outage does not prevent HTTP startup after the bounded PostgreSQL attempt. SIGINT/SIGTERM hooks are enabled in `main.ts`.

`/health` and `/health/live` remain process-only checks. `/health/ready` concurrently executes PostgreSQL `SELECT 1` and Redis `PING`, returning `200` only when both succeed. Failures/timeouts return `503`; responses include only `up`/`down` states and stable error text, never credentials, hostnames, or driver errors. Readiness is not cached. Concurrent requests share an active probe, but the next request probes again. Shutdown marks readiness unavailable before draining HTTP connections and closing dependency clients.

Healthy response:

```json
{"data":{"status":"ready","checks":{"postgres":"up","redis":"up"}}}
```

Unavailable response (HTTP 503):

```json
{"error":{"code":"DEPENDENCIES_UNAVAILABLE","message":"Required services are unavailable","checks":{"postgres":"up","redis":"down"}}}
```

`DEPENDENCY_TIMEOUT_MS` defaults to `2000` (allowed range `100–10000`). It bounds each readiness probe, PostgreSQL pool connection/query/server statement timeouts, and Redis connection/PING attempts. The PostgreSQL pool is limited to 10 connections. Redis rejects commands while offline and limits its command queue to 100. Future background jobs that require longer SQL execution must deliberately configure their own limits rather than silently inheriting a short request timeout. Readiness proves connectivity only, not that migrations or business features are complete.

Identity, page/block publishing, appearance/social profiles and managed media are implemented. Request IDs, structured request logging, analytics and QR remain planned work.

### Verification

```sh
pnpm --filter api test
pnpm --filter api test:infra
```

The first command uses mocked dependency providers and checks configuration, HTTP status/envelopes, timeouts, recovery, concurrency, and lifecycle hooks without PostgreSQL/Redis. The second requires a running Docker engine and starts uniquely named temporary PostgreSQL/Redis containers. It tests startup outages, recovery, stalled services, independent liveness, Redis closure, and PostgreSQL pool cleanup. Containers are removed afterward; it does not touch the development database.

For manual verification, start the Compose services, then the API, and request `/api/v1/health/ready`. Stop either local service and confirm readiness returns `503` while liveness remains `200`; restart it and confirm readiness returns `200` again.

Framework references: [NestJS first steps](https://docs.nestjs.com/first-steps) and [request validation](https://docs.nestjs.com/techniques/validation).

Dependency lifecycle references: [NestJS lifecycle hooks](https://docs.nestjs.com/fundamentals/lifecycle-events) and [node-redis connections](https://redis.io/docs/latest/develop/clients/nodejs/connect/).

## Identity endpoints

Registration, login/logout, cookie sessions, username availability and own-profile updates are implemented. See [the identity API contract and local curl guide](../../docs/05-IDENTITY-API.md) for all endpoints, request bodies, headers, limits and acceptance checks. Shared contracts live in `packages/types` and `packages/validation`; API build/dev/typecheck build them automatically.

Run `pnpm --filter api test:auth` from the root for the isolated real PostgreSQL/Redis identity journey (Docker required). FE integration is still pending.

Google signup/login is now included. See [Google credentials, migration and local browser testing](../../docs/06-GOOGLE-LOGIN.md).

Page/LINK CRUD, publishing and public lookup are implemented and listed in Swagger. Apply all migrations with `pnpm db:deploy` and restart the API before testing. See [the page contract and FE fixture](../../docs/07-PAGE-LINK-CONTRACT.md). Run `pnpm --filter api test:pages` for isolated database verification.

TEXT blocks and transactional reordering are implemented. See [editor API examples and validation rules](../../docs/08-TEXT-AND-REORDER.md); apply the TEXT migration with `pnpm db:deploy` and restart the API.

Appearance, system themes/templates and social-profile APIs are implemented. See [the appearance/social setup and endpoint guide](../../docs/09-APPEARANCE-AND-SOCIALS.md); apply migrations and restart the API before testing.

Managed avatar/IMAGE uploads support local storage and Cloudflare R2. See [the media contract, security limits and local flow](../../docs/12-MEDIA-API.md). Run `pnpm --filter api test:pages` for the complete upload, ownership, attachment and deletion journey.
