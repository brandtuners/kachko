// Root API route placeholder (§5: /api/* are BFF routes only, not business logic).
// Real API lives in the NestJS app; this is reached at /api/v1/* via the Next
// rewrite proxy in next.config.ts (Appendix A). Health probe passthrough below
// demonstrates the same-origin proxy returning 200 from the API.
import { NextResponse } from "next/server";

export async function GET() {
  // In M0 this confirms the dev proxy works: hit /api/v1/health/live.
  return NextResponse.json({ data: { ok: true, note: "web BFF root" } });
}
