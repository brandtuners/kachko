import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return new Response('Link not found', { status: 404 });
  const url = new URL(`/api/v1/social/dm/${encodeURIComponent(token)}`, process.env.API_URL ?? 'http://localhost:4000');
  try {
    const upstream = await fetch(url, { cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(5000) });
    const destination = upstream.headers.get('location');
    if (upstream.status !== 302 || !destination || !/^https?:\/\//i.test(destination)) return new Response('Link unavailable', { status: 404 });
    return new Response(null, { status: 302, headers: { Location: destination, 'Cache-Control': 'private, no-store' } });
  } catch { return new Response('Please try this link again', { status: 503 }); }
}
