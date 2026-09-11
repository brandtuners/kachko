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
  return { ...env, NODE_ENV: nodeEnv, PORT: port, CORS_ORIGINS: allowedOrigins };
}
