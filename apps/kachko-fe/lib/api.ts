// API client — calls relative /api/v1/* (same-origin, AD-01). Never calls a
// separate API host. Parses the { data } / { error: { code } } envelope (§7.1).
export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (json?.error) {
    throw new ApiClientError(json.error.code, String(json.error.message), json.error.details);
  }
  if (!res.ok) throw new ApiClientError(`HTTP_${res.status}`, `Request failed (${res.status})`);
  if (!json || !("data" in json)) throw new ApiClientError("INVALID_RESPONSE", "The API returned an unexpected response");
  return json.data as T;
}

function requestOptions(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes((init.method ?? "GET").toUpperCase())) {
    headers.set("X-Kachko-CSRF", "1");
  }
  return { ...init, headers, credentials: "include" };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return parse<T>(await fetch(`/api/v1${path}`, requestOptions(init)));
}

export async function serverApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return parse<T>(await fetch(`${BASE}/api/v1${path}`, { ...requestOptions(init), cache: "no-store" }));
}
