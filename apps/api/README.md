# Kachko API

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

Local defaults work without an env file. Copy `apps/api/.env.example` to `apps/api/.env` to override them. Workspace scripts run with the API directory as their working directory.

- Health: `http://localhost:4000/api/v1/health`
- Liveness: `http://localhost:4000/api/v1/health/live`
- OpenAPI UI: `http://localhost:4000/api/docs` (disabled in production)
- Success envelope: `{ "data": ... }`; errors: `{ "error": { "code": ..., "message": ... } }`.

The scaffold includes configuration validation, global request validation, CORS, Helmet, exception handling, and health routes. Nest uses its Express adapter internally; application code uses Nest modules/controllers/providers. Production requires an explicit comma-separated `CORS_ORIGINS` allowlist.

Database/Redis connections, dependency readiness, request IDs, structured logging, authentication, rate limiting, and business modules remain planned work in the development blueprint. Health currently reports process health only. Add each business module as its feature is implemented; do not create placeholder APIs.

Framework references: [NestJS first steps](https://docs.nestjs.com/first-steps) and [request validation](https://docs.nestjs.com/techniques/validation).
