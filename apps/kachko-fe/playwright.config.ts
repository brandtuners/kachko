import { defineConfig, devices } from "@playwright/test";

const e2eDatabaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://kachko:kachko@127.0.0.1:5432/kachko";
const e2eRedisUrl = process.env.E2E_REDIS_URL ?? "redis://127.0.0.1:6379/15";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "../api/test/e2e-global-setup.mjs",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "pnpm -w db:deploy && pnpm --filter api build && pnpm --filter api start",
      url: "http://127.0.0.1:4100/api/v1/health/ready",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { DATABASE_URL: e2eDatabaseUrl, REDIS_URL: e2eRedisUrl, PORT: "4100",
        CORS_ORIGINS: "http://127.0.0.1:3100", PUBLIC_APP_URL: "http://127.0.0.1:3100",
        ANALYTICS_HASH_SALT: "kachko-e2e-analytics-salt-at-least-32-characters", MEDIA_STORAGE: "local",
        MEDIA_LOCAL_DIR: "./tmp/e2e-media", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", GOOGLE_LOGIN_REDIRECT_URL: "" },
    },
    {
      command: "pnpm exec next dev -p 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { API_URL: "http://127.0.0.1:4100", NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100" },
    },
  ],
});
