"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { IdentityUser, ModerationReport, ReportStatus } from "@kachko/types";
import { ApiClientError, apiFetch } from "../../lib/api";
import { ObLogo } from "../onboarding/ob-shell";

type AdminHealth = { status: "ok"; users: number; pages: number; publishedPages: number; openReports: number };
type AdminUser = {
  id: string; email: string; username: string; displayName: string | null; avatarUrl: string | null;
  role: "USER" | "MODERATOR" | "ADMIN"; isActive: boolean; isVerified: boolean; deletedAt: string | null; createdAt: string;
  pages: { id: string; slug: string; isPrimary: boolean; isPublished: boolean }[];
  _count: { sessions: number; reports: number };
};
type AdminPage = {
  id: string; slug: string; isPrimary: boolean; title: string | null; description: string | null; isPublished: boolean;
  publishedAt: string | null; createdAt: string; updatedAt: string;
  user: { id: string; username: string; email: string; isActive: boolean };
  _count: { blocks: number; reports: number; analytics: number };
};
type AuditRow = { id: string; action: string; entityType: string; entityId: string | null; createdAt: string; actor?: { username: string } | null };

const nav = [
  ["/admin", "Overview"], ["/admin/users", "Users"], ["/admin/pages", "Pages"], ["/admin/reports", "Reports"],
] as const;

export function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: () => apiFetch<IdentityUser>("/auth/me"), retry: false });

  useEffect(() => {
    if (me.error instanceof ApiClientError && me.error.code === "UNAUTHENTICATED") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [me.error, pathname, router]);

  if (me.isLoading || (me.isError && me.error instanceof ApiClientError && me.error.code === "UNAUTHENTICATED")) {
    return <main className="grid min-h-dvh place-items-center bg-[#fbfaf6]"><span className="h-8 w-8 animate-spin rounded-full border-2 border-[#dfe3d9] border-t-[#111312]" /></main>;
  }
  if (me.isError) return <AdminGateError message={me.error.message} />;
  if (me.data?.role !== "ADMIN") return <AdminGateError message="This area is restricted to Kachko administrators." />;

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST", body: "{}" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  };
  return (
    <div className="min-h-dvh bg-[#fbfaf6] text-[var(--k-ink)]">
      <header className="sticky top-0 z-30 border-b border-[#e7e9e3] bg-[#fbfaf6]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4"><ObLogo /><span className="rounded-full bg-[var(--k-lime-soft)] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.16em] text-[#607817]">Admin</span></div>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto" aria-label="Admin sections">
            {nav.map(([href, label]) => {
              const active = pathname === href;
              return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-bold transition ${active ? "bg-[#111312] text-white" : "text-[#666c68] hover:bg-[#eff1eb]"}`}>{label}</Link>;
            })}
          </nav>
          <div className="flex items-center gap-3 text-sm"><span className="hidden text-[#767c78] md:inline">@{me.data.username}</span><Link href="/dashboard" className="k-btn-line !h-9 !rounded-full !px-4 text-xs">Dashboard</Link><button type="button" onClick={logout} className="text-xs font-bold text-[#9f302b] hover:underline">Log out</button></div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-5 py-10 sm:px-8">{children}</main>
    </div>
  );
}

function AdminGateError({ message }: { message: string }) {
  return <main className="grid min-h-dvh place-items-center bg-[#fbfaf6] px-5"><div className="k-panel max-w-md p-8 text-center"><p className="k-eyebrow">Restricted</p><h1 className="text-2xl font-extrabold">Admin access required</h1><p className="mt-2 text-sm text-[var(--k-muted)]">{message}</p><Link href="/dashboard" className="k-btn-ink mt-5 inline-flex">Return to dashboard</Link></div></main>;
}

function PageHead({ eyebrow = "Administration", title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <header className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="k-eyebrow !mb-2">{eyebrow}</p><h1 className="text-3xl font-extrabold tracking-[-1px]">{title}</h1><p className="mt-1 text-sm text-[var(--k-muted)]">{description}</p></div>{action}</header>;
}

export function AdminOverview() {
  const health = useQuery({ queryKey: ["admin", "health"], queryFn: () => apiFetch<AdminHealth>("/admin/system/health") });
  const audit = useQuery({ queryKey: ["admin", "audit"], queryFn: () => apiFetch<AuditRow[]>("/admin/audit-logs") });
  return <><PageHead title="Overview" description="System activity and moderation health." />
    {health.isError ? <ErrorCard message="Could not load system totals." /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Users" value={health.data?.users} href="/admin/users" />
      <Metric label="Pages" value={health.data?.pages} href="/admin/pages" />
      <Metric label="Published" value={health.data?.publishedPages} href="/admin/pages" />
      <Metric label="Open reports" value={health.data?.openReports} href="/admin/reports" attention={Boolean(health.data?.openReports)} />
    </div>}
    <section className="mt-9"><h2 className="text-xl font-extrabold">Recent audit activity</h2><p className="mt-1 text-sm text-[var(--k-muted)]">Security-sensitive administrator and moderation actions.</p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#e4e7e0] bg-white">{audit.isLoading ? <Loading /> : audit.isError ? <ErrorCard message="Could not load audit activity." bare /> : audit.data?.length ? <ul>{audit.data.slice(0, 25).map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eceee9] px-5 py-3.5 last:border-0"><span className="text-sm"><strong>{friendly(row.action)}</strong> · {row.entityType}{row.entityId ? ` ${row.entityId.slice(0, 8)}…` : ""}</span><span className="text-xs text-[var(--k-muted)]">{row.actor?.username ?? "system"} · {formatDate(row.createdAt)}</span></li>)}</ul> : <Empty message="No audit activity yet." />}</div>
    </section>
  </>;
}

function Metric({ label, value, href, attention = false }: { label: string; value?: number; href: string; attention?: boolean }) {
  return <Link href={href} className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${attention ? "border-[#d8e9a0] bg-[#f1f8dc]" : "border-[#e4e7e0] bg-white"}`}><p className="text-xs font-bold uppercase tracking-[.12em] text-[#848a86]">{label}</p><p className="mt-3 text-4xl font-extrabold">{value ?? "—"}</p></Link>;
}

export function AdminUsers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<{ user: AdminUser; action: "suspend" | "reactivate" | "delete" } | null>(null);
  const users = useQuery({ queryKey: ["admin", "users", q], queryFn: () => apiFetch<AdminUser[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`) });
  const action = useMutation({
    mutationFn: async (target: NonNullable<typeof confirm>) => target.action === "delete"
      ? apiFetch(`/admin/users/${target.user.id}`, { method: "DELETE", body: JSON.stringify({ confirmation: "DELETE" }) })
      : apiFetch(`/admin/users/${target.user.id}/status`, { method: "PATCH", body: JSON.stringify({ isActive: target.action === "reactivate" }) }),
    onSuccess: () => { setConfirm(null); void qc.invalidateQueries({ queryKey: ["admin"] }); },
  });
  return <><PageHead title="Users" description="Review accounts, revoke access, or permanently remove an account." action={<Search value={q} onChange={setQ} placeholder="Search users" />} />
    <div className="overflow-x-auto rounded-2xl border border-[#e4e7e0] bg-white">{users.isLoading ? <Loading /> : users.isError ? <ErrorCard message="Could not load users." bare /> : !users.data?.length ? <Empty message="No users match your search." /> : <table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-[#f5f6f1] text-[11px] uppercase tracking-[.1em] text-[#777d79]"><tr><Th>User</Th><Th>Role</Th><Th>Pages</Th><Th>Joined</Th><Th>Status</Th><Th align="right">Actions</Th></tr></thead><tbody>{users.data.map(user => <tr key={user.id} className="border-t border-[#eceee9]"><Td><div className="flex items-center gap-3"><Avatar user={user} /><div><p className="font-bold">{user.displayName ?? user.username}</p><p className="text-xs text-[var(--k-muted)]">@{user.username} · {user.email}</p></div></div></Td><Td><Badge tone={user.role === "ADMIN" ? "lime" : user.role === "MODERATOR" ? "amber" : "gray"}>{user.role}</Badge></Td><Td>{user.pages.length ? <span className="font-semibold">{user.pages.length} page{user.pages.length === 1 ? "" : "s"}</span> : <span className="text-[#a0a5a1]">No pages</span>}</Td><Td>{formatDate(user.createdAt)}</Td><Td><Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "Active" : "Suspended"}</Badge></Td><Td align="right"><div className="flex justify-end gap-2">{user.role !== "ADMIN" ? <><button type="button" onClick={() => setConfirm({ user, action: user.isActive ? "suspend" : "reactivate" })} className="k-btn-line !h-8 !rounded-lg !px-3 !text-xs">{user.isActive ? "Suspend" : "Reactivate"}</button><button type="button" onClick={() => setConfirm({ user, action: "delete" })} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50">Delete</button></> : <span className="text-xs text-[#9ca19d]">Protected</span>}</div></Td></tr>)}</tbody></table>}</div>
    {confirm ? <ConfirmModal title={confirm.action === "delete" ? `Delete @${confirm.user.username}?` : `${confirm.action === "suspend" ? "Suspend" : "Reactivate"} @${confirm.user.username}?`} danger={confirm.action !== "reactivate"} busy={action.isPending} error={action.error?.message} confirmText={confirm.action === "delete" ? confirm.user.username : undefined} actionLabel={confirm.action === "delete" ? "Delete permanently" : confirm.action === "suspend" ? "Suspend account" : "Reactivate account"} onCancel={() => setConfirm(null)} onConfirm={() => action.mutate(confirm)}>{confirm.action === "delete" ? "This permanently deletes the account, page, blocks, analytics, and stored media. This cannot be undone." : confirm.action === "suspend" ? "This immediately revokes active sessions and unpublishes the user's page." : "This restores sign-in access. Their page remains unpublished until they publish it again."}</ConfirmModal> : null}
  </>;
}

export function AdminPages() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<AdminPage | null>(null);
  const pages = useQuery({ queryKey: ["admin", "pages", q], queryFn: () => apiFetch<AdminPage[]>(`/admin/pages${q ? `?q=${encodeURIComponent(q)}` : ""}`) });
  const unpublish = useMutation({ mutationFn: (id: string) => apiFetch(`/admin/pages/${id}/status`, { method: "PATCH", body: JSON.stringify({ isPublished: false }) }), onSuccess: () => { setTarget(null); void qc.invalidateQueries({ queryKey: ["admin"] }); } });
  return <><PageHead title="Pages" description="Inspect every creator page and remove unsafe pages from public view." action={<Search value={q} onChange={setQ} placeholder="Search pages" />} />
    <div className="overflow-x-auto rounded-2xl border border-[#e4e7e0] bg-white">{pages.isLoading ? <Loading /> : pages.isError ? <ErrorCard message="Could not load pages." bare /> : !pages.data?.length ? <Empty message="No pages match your search." /> : <table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-[#f5f6f1] text-[11px] uppercase tracking-[.1em] text-[#777d79]"><tr><Th>Page</Th><Th>Owner</Th><Th>Content</Th><Th>Reports</Th><Th>Status</Th><Th align="right">Actions</Th></tr></thead><tbody>{pages.data.map(page => <tr key={page.id} className="border-t border-[#eceee9]"><Td><p className="font-bold">{page.title ?? `@${page.slug}`}</p><p className="text-xs text-[var(--k-muted)]">{publicHref(page.user.username, page.slug, page.isPrimary)} · updated {formatDate(page.updatedAt)}</p></Td><Td><p className="font-semibold">@{page.user.username}</p><p className="text-xs text-[var(--k-muted)]">{page.user.email}</p></Td><Td>{page._count.blocks} blocks · {page._count.analytics} events</Td><Td>{page._count.reports}</Td><Td><Badge tone={page.isPublished ? "green" : "gray"}>{page.isPublished ? "Published" : "Draft"}</Badge></Td><Td align="right"><div className="flex justify-end gap-2">{page.isPublished ? <><Link href={publicHref(page.user.username, page.slug, page.isPrimary)} target="_blank" className="k-btn-line !h-8 !rounded-lg !px-3 !text-xs">View ↗</Link><button type="button" onClick={() => setTarget(page)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50">Unpublish</button></> : <span className="text-xs text-[#9ca19d]">Not public</span>}</div></Td></tr>)}</tbody></table>}</div>
    {target ? <ConfirmModal title={`Unpublish /${target.slug}?`} danger busy={unpublish.isPending} error={unpublish.error?.message} actionLabel="Unpublish page" onCancel={() => setTarget(null)} onConfirm={() => unpublish.mutate(target.id)}>Visitors will no longer be able to open this page. The owner can edit it but must publish it again.</ConfirmModal> : null}
  </>;
}

export function AdminReports() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ReportStatus>("OPEN");
  const reports = useQuery({ queryKey: ["admin", "reports", status], queryFn: () => apiFetch<ModerationReport[]>(`/admin/reports?status=${status}`) });
  const update = useMutation({ mutationFn: ({ id, next }: { id: string; next: "RESOLVED" | "REJECTED" }) => apiFetch(`/admin/reports/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) }), onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin"] }) });
  return <><PageHead title="Reports" description="Review community reports and record a moderation decision." action={<div className="flex rounded-full border border-[#dfe2dc] bg-white p-1">{(["OPEN", "RESOLVED", "REJECTED"] as const).map(value => <button key={value} type="button" onClick={() => setStatus(value)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${status === value ? "bg-[#111312] text-white" : "text-[#6f7571]"}`}>{friendly(value)}</button>)}</div>} />
    {reports.isLoading ? <div className="k-panel"><Loading /></div> : reports.isError ? <ErrorCard message="Could not load reports." /> : !reports.data?.length ? <div className="k-panel"><Empty message={`No ${status.toLowerCase()} reports.`} /></div> : <ul className="grid gap-3">{reports.data.map(report => <li key={report.id} className="k-panel p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><Badge tone="red">{friendly(report.reason)}</Badge><Link href={publicHref(report.page.user.username, report.page.slug, report.page.isPrimary)} target="_blank" className="font-bold hover:underline">{publicHref(report.page.user.username, report.page.slug, report.page.isPrimary)} ↗</Link></div><p className="mt-2 text-sm text-[var(--k-muted)]">Reported by {report.reporter?.username ? `@${report.reporter.username}` : "an anonymous visitor"} · {formatDate(report.createdAt)}</p>{report.details ? <p className="mt-3 max-w-3xl rounded-xl bg-[#f5f6f1] p-3 text-sm">{report.details}</p> : null}</div>{report.status === "OPEN" ? <div className="flex gap-2"><button type="button" disabled={update.isPending} onClick={() => update.mutate({ id: report.id, next: "REJECTED" })} className="k-btn-line !h-9 !rounded-full !px-4 text-xs">Reject</button><button type="button" disabled={update.isPending} onClick={() => update.mutate({ id: report.id, next: "RESOLVED" })} className="k-btn-ink !h-9 !px-4 text-xs">Resolve</button></div> : <Badge tone={report.status === "RESOLVED" ? "green" : "gray"}>{friendly(report.status)}</Badge>}</div></li>)}</ul>}
  </>;
}

function ConfirmModal({ title, children, actionLabel, confirmText, danger = false, busy, error, onCancel, onConfirm }: { title: string; children: ReactNode; actionLabel: string; confirmText?: string; danger?: boolean; busy: boolean; error?: string; onCancel: () => void; onConfirm: () => void }) {
  const [typed, setTyped] = useState("");
  const enabled = !confirmText || typed === confirmText;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#111312]/45 px-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}><div role="alertdialog" aria-modal="true" aria-labelledby="admin-confirm-title" className="w-full max-w-md rounded-3xl border border-[#dfe3d9] bg-[#fbfaf6] p-6 shadow-[0_24px_80px_rgba(17,19,18,.3)]"><h2 id="admin-confirm-title" className="text-xl font-extrabold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-[var(--k-muted)]">{children}</p>{confirmText ? <label className="mt-5 block text-xs font-bold">Type <span className="font-mono">{confirmText}</span> to confirm<input autoFocus value={typed} onChange={event => setTyped(event.target.value)} className="dash-input mt-2" /></label> : null}{error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}<div className="mt-6 flex justify-end gap-2"><button type="button" disabled={busy} onClick={onCancel} className="k-btn-line !rounded-full">Cancel</button><button type="button" disabled={busy || !enabled} onClick={onConfirm} className={`h-11 rounded-full px-5 text-sm font-extrabold disabled:opacity-50 ${danger ? "bg-[#b4322c] text-white" : "bg-[#111312] text-white"}`}>{busy ? "Working…" : actionLabel}</button></div></div></div>;
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) { return <input type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="h-11 min-w-64 rounded-full border border-[#dfe2dc] bg-white px-4 text-sm outline-none focus:border-[#9fca25]" />; }
function Avatar({ user }: { user: AdminUser }) { return user.avatarUrl ? (
  // eslint-disable-next-line @next/next/no-img-element -- avatars may be served by configured object storage
  <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
) : <span className="grid h-10 w-10 place-items-center rounded-full bg-[#edf1e5] font-extrabold">{(user.displayName ?? user.username).slice(0, 1).toUpperCase()}</span>; }
function Badge({ children, tone }: { children: ReactNode; tone: "green" | "red" | "gray" | "lime" | "amber" }) { const tones = { green: "bg-emerald-50 text-emerald-700", red: "bg-red-50 text-red-700", gray: "bg-[#eff1ed] text-[#666c68]", lime: "bg-[#eff8d4] text-[#607817]", amber: "bg-amber-50 text-amber-700" }; return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.08em] ${tones[tone]}`}>{children}</span>; }
function Loading() { return <div className="flex items-center justify-center gap-3 p-10 text-sm text-[var(--k-muted)]"><span className="h-5 w-5 animate-spin rounded-full border-2 border-[#dfe3d9] border-t-[#111312]" />Loading…</div>; }
function Empty({ message }: { message: string }) { return <p className="p-12 text-center text-sm text-[var(--k-muted)]">{message}</p>; }
function ErrorCard({ message, bare = false }: { message: string; bare?: boolean }) { return <div role="alert" className={`${bare ? "" : "rounded-2xl border border-red-200 bg-red-50"} p-6 text-sm font-semibold text-red-700`}>{message}</div>; }
function Th({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) { return <th className={`px-5 py-3 font-extrabold ${align === "right" ? "text-right" : ""}`}>{children}</th>; }
function Td({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) { return <td className={`px-5 py-4 align-middle ${align === "right" ? "text-right" : ""}`}>{children}</td>; }
function friendly(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/^./, char => char.toUpperCase()); }
function formatDate(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
function publicHref(username: string, slug: string, isPrimary: boolean) { return `/${username}${isPrimary ? "" : `/${slug}`}`; }
