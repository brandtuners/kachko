function connectionUrl(env: Record<string, unknown>, key: 'DATABASE_URL' | 'REDIS_URL'): string {
  const value = env[key];
  const message = key === 'DATABASE_URL'
    ? 'DATABASE_URL must be a PostgreSQL URL with a host, username, and database name'
    : 'REDIS_URL must be a redis:// or rediss:// URL with a host and optional numeric database';
  if (typeof value !== 'string' || value.trim() !== value || !value) throw new Error(message);
  try {
    const url = new URL(value);
    if (!url.hostname || url.hash || url.port === '0') throw new Error(message);
    if (key === 'DATABASE_URL') {
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username ||
          url.pathname.length < 2 || url.pathname.slice(1).includes('/')) throw new Error(message);
    } else if (!['redis:', 'rediss:'].includes(url.protocol) ||
        !/^\/(\d+)?$|^$/.test(url.pathname) || url.search) throw new Error(message);
    return value;
  } catch {
    // Do not include supplied URLs: they may contain credentials.
    throw new Error(message);
  }
}

export function validateEnvironment(env: Record<string, unknown>) {
  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const nodeEnv = String(env.NODE_ENV ?? 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }
  const origins = String(env.CORS_ORIGINS ?? (nodeEnv === 'production' ? '' : 'http://localhost:3000'));
  const allowedOrigins = origins.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (allowedOrigins.length === 0) throw new Error('CORS_ORIGINS is required');
  for (const origin of allowedOrigins) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error('CORS_ORIGINS must contain exact HTTP(S) origins');
    }
  }
  const timeout = Number(env.DEPENDENCY_TIMEOUT_MS ?? 2000);
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 10000) {
    throw new Error('DEPENDENCY_TIMEOUT_MS must be an integer between 100 and 10000');
  }
  return {
    ...env, NODE_ENV: nodeEnv, PORT: port, CORS_ORIGINS: allowedOrigins,
    DATABASE_URL: connectionUrl(env, 'DATABASE_URL'),
    REDIS_URL: connectionUrl(env, 'REDIS_URL'),
    DEPENDENCY_TIMEOUT_MS: timeout,
  };
}
