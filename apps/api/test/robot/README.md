# Robot Framework API suite

This is a black-box V1 smoke suite for a locally running NestJS API. It uses
the PostgreSQL and Redis services from the root `docker-compose.yml`, creates a
unique test account, exercises the owner/public journey, and logs out at the
end. Resend is not required because the suite does not request a reset email.

## Run locally

Install Robot Framework once:

```sh
python3 -m pip install -r apps/api/test/robot/requirements.txt
```

Start infrastructure, apply migrations, and start the API in another terminal:

```sh
docker compose up -d postgres redis
pnpm db:deploy
pnpm --filter api dev
```

Run the suite from the repository root:

```sh
robot --outputdir apps/api/test/robot/results apps/api/test/robot/v1_smoke.robot
```

Use another API origin when needed:

```sh
robot --variable BASE_URL:https://api-staging.kachko.in \
  --variable PUBLIC_APP_URL:https://staging.kachko.in \
  --outputdir apps/api/test/robot/results apps/api/test/robot/v1_smoke.robot
```

The suite expects `PUBLIC_APP_URL=http://localhost:3000` for the QR URL
assertion. Set the Robot `PUBLIC_APP_URL` variable to the deployed frontend
origin when running against another environment.
The test intentionally uses a disposable `example.com` address and does not
test Resend delivery; password-reset provider verification remains an
operator check.
