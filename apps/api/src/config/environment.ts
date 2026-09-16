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
  const sessionTtl = Number(env.SESSION_TTL_SECONDS ?? 604800);
  if (!Number.isInteger(sessionTtl) || sessionTtl < 60 || sessionTtl > 2592000) {
    throw new Error('SESSION_TTL_SECONDS must be an integer between 60 and 2592000');
  }
  const cookieName = String(env.SESSION_COOKIE_NAME ?? 'kachko_session');
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(cookieName)) throw new Error('SESSION_COOKIE_NAME must be a simple cookie name');
  const analyticsSalt = String(env.ANALYTICS_HASH_SALT ?? (nodeEnv === 'production' ? '' : 'kachko-development-analytics-salt'));
  if (analyticsSalt.length < 32) throw new Error('ANALYTICS_HASH_SALT must contain at least 32 characters');
  const googleId = String(env.GOOGLE_CLIENT_ID ?? '').trim();
  const googleSecret = String(env.GOOGLE_CLIENT_SECRET ?? '').trim();
  if (Boolean(googleId) !== Boolean(googleSecret)) throw new Error('Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  const googleCallback = String(env.GOOGLE_REDIRECT_URI ?? `http://localhost:${port}/api/v1/auth/google/callback`);
  const googleRedirect = String(env.GOOGLE_LOGIN_REDIRECT_URL ?? '');
  const mediaStorage = String(env.MEDIA_STORAGE ?? 'local');
  if (!['local', 'r2'].includes(mediaStorage)) throw new Error('MEDIA_STORAGE must be local or r2');
  const mediaLocalDir = String(env.MEDIA_LOCAL_DIR ?? './tmp/media');
  if (!mediaLocalDir || mediaLocalDir.includes('\0')) throw new Error('MEDIA_LOCAL_DIR is invalid');
  const r2Values = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'] as const;
  const r2 = Object.fromEntries(r2Values.map(key => [key, String(env[key] ?? '').trim()])) as Record<(typeof r2Values)[number], string>;
  if (mediaStorage === 'r2' && r2Values.some(key => !r2[key])) throw new Error('R2 storage requires account, credentials, bucket and public URL');
  if (r2.R2_PUBLIC_URL) {
    const url = new URL(r2.R2_PUBLIC_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('R2_PUBLIC_URL must be a clean HTTPS URL');
  }
  if (googleId) {
    for (const value of [googleCallback, ...(googleRedirect ? [googleRedirect] : [])]) {
      const url = new URL(value);
      if (url.username || url.password || url.hash || url.search ||
          (url.protocol !== 'https:' && !(nodeEnv !== 'production' && url.protocol === 'http:' && url.hostname === 'localhost'))) {
        throw new Error('Google redirect URLs must be HTTPS (localhost HTTP allowed outside production), without credentials, query or fragment');
      }
    }
    if (new URL(googleCallback).pathname !== '/api/v1/auth/google/callback') throw new Error('GOOGLE_REDIRECT_URI must use /api/v1/auth/google/callback');
    if (googleRedirect && !allowedOrigins.includes(new URL(googleRedirect).origin)) throw new Error('Google frontend redirect origin must be in CORS_ORIGINS');
  }
  return {
    ...env, SESSION_TTL_SECONDS: sessionTtl, SESSION_COOKIE_NAME: cookieName, ANALYTICS_HASH_SALT: analyticsSalt, NODE_ENV: nodeEnv, PORT: port, CORS_ORIGINS: allowedOrigins,
    GOOGLE_CLIENT_ID: googleId, GOOGLE_CLIENT_SECRET: googleSecret, GOOGLE_REDIRECT_URI: googleCallback, GOOGLE_LOGIN_REDIRECT_URL: googleRedirect,
    DATABASE_URL: connectionUrl(env, 'DATABASE_URL'),
    REDIS_URL: connectionUrl(env, 'REDIS_URL'),
    DEPENDENCY_TIMEOUT_MS: timeout,
    MEDIA_STORAGE: mediaStorage, MEDIA_LOCAL_DIR: mediaLocalDir, ...r2,
  };
}
