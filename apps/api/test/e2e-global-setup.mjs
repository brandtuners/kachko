import { createClient } from 'redis';

export default async function resetE2eRedis() {
  const redisUrl = process.env.E2E_REDIS_URL ?? 'redis://127.0.0.1:6379/15';
  const url = new URL(redisUrl);
  if (url.pathname !== '/15') {
    throw new Error(`Refusing to clear Redis outside the isolated E2E database: ${url.pathname || '/0'}`);
  }

  const client = createClient({ url: redisUrl });
  await client.connect();
  try {
    await client.flushDb();
  } finally {
    await client.quit();
  }
}
