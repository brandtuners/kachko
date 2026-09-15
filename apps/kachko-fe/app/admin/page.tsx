"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import { ObLogo } from "../../features/onboarding/ob-shell";

interface ReportRow {
  id: string;
  reason: string;
  status: string;
  details: string | null;
  createdAt: string;
  page?: { slug: string } | null;
  reporter?: { username: string };
}

// Admin console (M9). Role-gated at the API (SessionAuthGuard + RoleGuard).
// Cream + lime scheme now app-wide; lists moderation reports with quick
// resolve/dismiss actions.
export default function AdminPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: () => apiFetch<ReportRow[]>("/moderation/reports?status=OPEN"),
  });

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--k-muted)]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#e3e6de] border-t-[#111312]" />
          Loading admin…
        </div>
      </main>
    );
  }

  const reports = data ?? [];

  return (
    <main className="relative min-h-screen">
      <header className="k-topbar">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5">
          <ObLogo />
          <span className="rounded-full bg-[var(--k-lime-soft)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.14em] text-[var(--k-lime-dark)]">
            Admin
          </span>
        </div>
      </header>

      <div className="container-app py-12">
        <header className="mb-8">
          <p className="k-eyebrow !mb-2">KACHKO</p>
          <h1 className="text-3xl font-extrabold tracking-[-1px] text-[var(--k-ink)]">Moderation</h1>
          <p className="mt-1 text-sm text-[var(--k-muted)]">Open abuse reports across KACHKO.</p>
        </header>

        {reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#dfe2dc] bg-white/70 p-10 text-center text-[var(--k-muted)]">
            No open reports. The community is (for now) well-behaved.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((r) => (
              <li key={r.id} className="k-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#fdeceb] px-2 py-0.5 text-xs font-bold text-[#b4322c]">
                      {r.reason}
                    </span>
                    <span className="text-sm text-[var(--k-text)]">
                      {r.page?.slug ? `@${r.page.slug}` : "general"} · by {r.reporter?.username ?? "anon"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await apiFetch(`/moderation/reports/${r.id}/status`, {
                          method: "POST",
                          body: JSON.stringify({ status: "RESOLVED" }),
                        });
                        refetch();
                      }}
                      className="k-btn-lime !h-8 !rounded-lg !px-3 !text-xs"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={async () => {
                        await apiFetch(`/moderation/reports/${r.id}/status`, {
                          method: "POST",
                          body: JSON.stringify({ status: "REJECTED" }),
                        });
                        refetch();
                      }}
                      className="k-btn-line !h-8 !rounded-lg !px-3 !text-xs"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                {r.details ? <p className="mt-2 text-sm text-[var(--k-muted)]">{r.details}</p> : null}
                <p className="mt-2 text-[11px] text-[#9a9f9b]">{new Date(r.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
