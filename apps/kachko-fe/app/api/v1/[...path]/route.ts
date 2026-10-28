import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { readProxyBody } from "@/lib/proxy-body";

const API_URL = process.env.API_URL ?? "http://localhost:4000";
const BODYLESS_METHODS = new Set(["GET", "HEAD"]);
const HOP_BY_HOP_HEADERS = [
  "connection",
  "content-encoding",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * Same-origin BFF for the Nest API. Clerk's browser cookie belongs to the
 * Next.js frontend, so a plain rewrite cannot reliably authenticate the
 * separate Nest process. Resolve the active session here and forward its JWT
 * as a bearer token instead.
 */
async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const upstreamUrl = new URL(
    `/api/v1/${path.map(encodeURIComponent).join("/")}`,
    API_URL,
  );
  upstreamUrl.search = request.nextUrl.search;

  const requestHeaders = new Headers(request.headers);
  for (const header of HOP_BY_HOP_HEADERS) requestHeaders.delete(header);

  const method = request.method.toUpperCase();
  let body: ArrayBuffer | undefined;
  try {
    body = BODYLESS_METHODS.has(method) ? undefined : await readProxyBody(request);
  } catch (error) {
    if (error instanceof RangeError) return Response.json({ error: {
      code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds the 5 MiB limit",
    } }, { status: 413, headers: { "Cache-Control": "no-store" } });
    throw error;
  }

  const { getToken } = await auth();
  const token = await getToken();
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
  const upstream = await fetch(upstreamUrl, {
    method,
    headers: requestHeaders,
    body,
    cache: "no-store",
    redirect: "manual",
  });

  const responseHeaders = new Headers(upstream.headers);
  for (const header of HOP_BY_HOP_HEADERS) responseHeaders.delete(header);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export {
  proxy as DELETE,
  proxy as GET,
  proxy as HEAD,
  proxy as OPTIONS,
  proxy as PATCH,
  proxy as POST,
  proxy as PUT,
};
