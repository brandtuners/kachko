import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

// Resolve root .env consistently, including calls from the API workspace.
config({ path: fileURLToPath(new URL('./.env', import.meta.url)), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Offline generation/validation need no URL; database commands require one.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
