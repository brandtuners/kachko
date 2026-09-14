# kachko

A personal link-page platform built with Next.js and NestJS.

- Frontend: `apps/kachko-fe` — Girish
- Backend: `apps/api` — Rohan
- [Development plan](docs/03-DEVELOPMENT-BLUEPRINT.md)
- [Automatic PR review setup](docs/04-PR-REVIEW-AGENT.md)

## Local PostgreSQL and Redis

Install Docker Desktop (or a compatible Docker Engine with Compose v2) and start it first. Run the commands below from the repository root. Next.js and NestJS run on the host; only PostgreSQL and Redis run in Docker.

Create local environment files without overwriting existing values:

```sh
cp -n .env.example .env
cp -n apps/api/.env.example apps/api/.env
```

If those files already exist, add any missing variables from the examples manually. Compose also has matching local defaults, so service startup works without copying `.env`.

Validate and start services, waiting for their health checks:

```sh
docker compose config --quiet
docker compose up -d --wait postgres redis
docker compose ps
```

| Service | Host address | Local configuration |
|---|---|---|
| PostgreSQL 16 | `127.0.0.1:5432` | Database/user/password: `kachko` |
| Redis 7 | `127.0.0.1:6379` | No password; local development only |

Ports are bound to the host's loopback interface. The sample credentials and unauthenticated Redis are intended only for local development.

Verify service responses:

```sh
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;"'
docker compose exec -T redis redis-cli ping
```

Expected: PostgreSQL returns `1`, Redis returns `PONG`, and `docker compose ps` reports both services healthy.

View logs or stop services:

```sh
docker compose logs --tail=100 postgres redis
docker compose down
```

Named volumes retain PostgreSQL data and Redis append-only data when containers are recreated or stopped with `down`. Redis remains disposable cache/transient storage; PostgreSQL is the source of truth. Avoid `down --volumes` unless intentionally deleting all local service data.

## Environment files and port conflicts

- Root `.env`: Compose service credentials and published ports, plus connection values for root Prisma migration commands.
- `apps/api/.env`: NestJS runtime configuration when launched with the workspace commands below. The API does not automatically read the root `.env`.
- If ports are occupied, set `POSTGRES_PORT=5433` and/or `REDIS_PORT=6380` in the root `.env`. Update `DATABASE_URL`/`REDIS_URL` in both environment files to match, then rerun `docker compose up -d --wait postgres redis`.
- Keep database/user/password values synchronized with the URLs. Percent-encode special characters in URL credentials. Use `127.0.0.1` for host applications; `postgres`/`redis` are service names for containers on the Compose network.
- PostgreSQL initialization variables only create users/databases when its data volume is empty. Changing them later does not change existing database credentials; update the database deliberately or restore the original environment values.
- If Docker reports it cannot connect to the daemon, start Docker Desktop and wait until its engine is ready.

## Applications

```sh
pnpm install
pnpm --filter api dev
```

In another terminal:

```sh
pnpm --filter kachko-fe dev
```

Frontend: `http://localhost:3000`. API health: `http://localhost:4000/api/v1/health`.

**Current scope:** local infrastructure, Prisma identity models/migration, NestJS PostgreSQL/Redis providers, and dependency readiness are implemented. Set the required `DATABASE_URL` and `REDIS_URL` in `apps/api/.env`. `/api/v1/health/ready` returns `200` when both services respond and `503` on failure; `/api/v1/health/live` remains independent of dependency availability. Identity authentication/profile APIs and shared contracts are now implemented; frontend integration remains pending. See the [API README](apps/api/README.md) for response examples, timeouts, lifecycle behavior, and `pnpm --filter api test:infra`.

## Prisma and identity database

Prisma database access belongs only to the API. The root holds the schema, migration history, and development CLI as specified in the project docs:

| Location | Responsibility |
|---|---|
| `prisma/schema.prisma` | User, Session and UserRole definitions |
| `prisma/migrations/` | Versioned PostgreSQL SQL migrations |
| `prisma.config.ts` | CLI configuration, loading root `.env` |
| Root `package.json` | Prisma CLI development dependency and `db:*` commands |
| `apps/api/package.json` | Prisma Client and PostgreSQL adapter runtime dependencies |
| `apps/api/src/generated/prisma/` | Generated API-only TypeScript client; ignored by Git |

The frontend has no Prisma dependency and must use API contracts rather than importing database models or the generated client. API build, dev, and typecheck scripts regenerate the client automatically. Prisma packages are pinned together at `7.10.0`; the generator uses CommonJS to match the NestJS compiler.

After setting up the root `.env` and starting PostgreSQL, run from the repository root:

```sh
pnpm install
pnpm db:validate
pnpm db:generate
pnpm db:deploy
pnpm db:status
```

`db:deploy` applies the checked-in initial migration to the database identified by the root `DATABASE_URL`; it does not reset existing data. Confirm that URL points to your intended database. No user or administrator accounts are seeded.

For subsequent schema changes during development:

```sh
pnpm db:migrate --name describe_your_change
pnpm db:generate
```

Review and commit the generated SQL. `migrate dev` needs a shadow database and may request a reset if the database has drifted; never point it at production or accept a reset of data you need. Deployment uses `pnpm db:deploy`. `pnpm db:studio` opens the database browser. A seed command will be introduced when seed data is needed; the previously unconfigured placeholder was removed.

The models include unique email/username/token hashes, account role/status fields, session expiry/revocation timestamps, and a cascading User → Session relation. Unique email/username constraints already create indexes, so the duplicate non-unique indexes shown in the LLD example are unnecessary. Future auth code must normalize email/usernames, enforce reserved-name/password rules, hash passwords/tokens, and check session expiry/revocation: the schema does not implement those behaviors.

### Database integration test

Use a **separate local database whose name ends in `_test`**. For example, with the Compose defaults, create it once:

```sh
docker compose exec -T postgres createdb -U kachko kachko_identity_test
DATABASE_URL=postgresql://kachko:kachko@127.0.0.1:5432/kachko_identity_test pnpm db:deploy
TEST_DATABASE_URL=postgresql://kachko:kachko@127.0.0.1:5432/kachko_identity_test pnpm db:test
```

Adjust credentials/ports if customized. The test checks defaults, unique constraints, foreign keys, persisted session timestamps, and cascade deletion through the generated Prisma client. It removes only its own fixtures. It refuses non-local databases, names without `_test`, and URLs with query overrides; it never falls back to the development `DATABASE_URL`. Existing API tests remain independent of database availability.

Prisma references: [client generation](https://www.prisma.io/docs/orm/prisma-schema/overview/generators) and [CLI configuration](https://www.prisma.io/docs/orm/reference/prisma-config-reference).

Configuration references: [Docker Compose services](https://docs.docker.com/reference/compose-file/services/), [official PostgreSQL image](https://hub.docker.com/_/postgres), and [official Redis image](https://hub.docker.com/_/redis).

### Identity API

Auth/session/profile endpoints and shared identity contracts are implemented. See [local endpoint testing and the FE contract](docs/05-IDENTITY-API.md). All identity mutations require `X-Kachko-CSRF: 1`; authenticated requests also send the session cookie.

Google signup/login is now included. See [Google credentials, migration and local browser testing](docs/06-GOOGLE-LOGIN.md).
