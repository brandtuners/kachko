import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Keep redirects dynamic so disabling or editing a link takes effect immediately. */
export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  if (!/^[A-Za-z0-9_-]{3,48}$/.test(code)) return new Response("Short link not found", { status: 404 });
  const headers = new Headers();
  for (const name of ["user-agent", "referer", "x-vercel-ip-country", "cf-ipcountry"]) {
    const value = request.headers.get(name); if (value) headers.set(name, value);
  }
  let upstream: Response;
  try {
    upstream = await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/api/v1/short-links/r/${encodeURIComponent(code)}`,
      { headers, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(5000) });
  } catch {
    return new Response("This link is temporarily unavailable. Please try again.", { status: 503, headers: { "Cache-Control": "no-store", 'Retry-After': '5' } });
  }
  const location = upstream.headers.get("location");
  if (upstream.status === 302 && location && /^https?:\/\//i.test(location)) {
    return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "private, no-store" } });
  }
  return new Response(upstream.status === 404 ? "This short link is unavailable" : "This link is temporarily unavailable. Please try again.",
    { status: upstream.status === 404 ? 404 : 503, headers: { "Cache-Control": "no-store" } });
}
