const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export function publicPageUrl(username: string, origin = configuredOrigin, pageSlug?: string) {
  const base = origin.endsWith('/') ? origin : `${origin}/`;
  const path = `/${encodeURIComponent(username)}${pageSlug ? `/${encodeURIComponent(pageSlug)}` : ''}`;
  return new URL(path, base).toString();
}

export function absoluteAssetUrl(path: string, origin = configuredOrigin) {
  return new URL(path, origin.endsWith('/') ? origin : `${origin}/`).toString();
}
