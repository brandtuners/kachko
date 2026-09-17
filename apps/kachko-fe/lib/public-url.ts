const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export function publicPageUrl(username: string, origin = configuredOrigin) {
  const base = origin.endsWith('/') ? origin : `${origin}/`;
  return new URL(`/@${encodeURIComponent(username)}`, base).toString();
}

export function absoluteAssetUrl(path: string, origin = configuredOrigin) {
  return new URL(path, origin.endsWith('/') ? origin : `${origin}/`).toString();
}
