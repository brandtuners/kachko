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

- Root `.env`: Compose service credentials and published ports, plus connection examples for future root database tooling.
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

**Current scope:** local infrastructure and environment examples are provided. The API currently reports process health only; it does not yet connect to PostgreSQL or Redis. NestJS clients, dependency readiness, Prisma models/migrations, and authentication are the next backend tasks. See the [API README](apps/api/README.md) for its existing commands.

Configuration references: [Docker Compose services](https://docs.docker.com/reference/compose-file/services/), [official PostgreSQL image](https://hub.docker.com/_/postgres), and [official Redis image](https://hub.docker.com/_/redis).
