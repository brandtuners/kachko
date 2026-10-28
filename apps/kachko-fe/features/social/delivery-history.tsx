"use client";

import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

interface Delivery {
  id: string;
  status: string;
  errorCode: string | null;
  createdAt: string;
  sentAt: string | null;
  nextAttemptAt: string;
  clicks: number;
  canRetry: boolean;
}
interface DeliveryPage { items: Delivery[]; nextCursor: string | null }
const reasons: Record<string, string> = {
  MONTHLY_LIMIT: "Monthly allowance reached", HOURLY_LIMIT: "Waiting for the hourly allowance to reset",
  AUTOMATION_PAUSED: "Automation paused or deleted", AUTOMATION_MOVED: "Automation moved to another account",
  ACCOUNT_RECONNECT_REQUIRED: "Reconnect Instagram", OWNER_INACTIVE: "Account inactive", PLAN_REQUIRED: "Automations plan required",
  COMMENT_EXPIRED: "The seven-day reply window expired", SEND_UNCONFIRMED: "Delivery could not be confirmed",
  INSTAGRAM_SEND_UNCONFIRMED: "Delivery could not be confirmed", PUBLIC_REPLY_FAILED: "DM sent, but the public comment reply failed",
  TOKEN_EXPIRED: "Instagram permission expired; reconnect the account",
};

export function DeliveryHistory({ automations, canRetry }: { automations: Array<{ id: string; name: string }>; canRetry: boolean }) {
  const [automationId, setAutomationId] = useState("");
  const qc = useQueryClient();
  const query = useInfiniteQuery({ queryKey: ["social", "deliveries", automationId], initialPageParam: "", enabled: Boolean(automationId),
    queryFn: ({ pageParam }) => apiFetch<DeliveryPage>(`/social/automations/${automationId}/deliveries${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: page => page.nextCursor ?? undefined, refetchInterval: 15_000 });
  const retry = useMutation({ mutationFn: (id: string) => apiFetch(`/social/deliveries/${id}/retry`, { method: 'POST' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social"] }); } });
  const items = query.data?.pages.flatMap(page => page.items) ?? [];
  return <section className="k-panel mb-5 p-5" aria-labelledby="delivery-history-title">
    <h2 id="delivery-history-title" className="mb-3 text-sm font-extrabold">Reply delivery history</h2>
    <label className="grid gap-1 text-xs font-bold">Automation<select className="dash-input" value={automationId} onChange={event => { setAutomationId(event.target.value); retry.reset(); }}>
      <option value="">Choose an auto-reply to inspect</option>{automations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {retry.error ? <p role="alert" className="mt-3 text-sm text-red-700">{retry.error.message}</p> : null}
    {retry.isSuccess ? <p role="status" className="mt-3 text-xs text-[#718c1b]">Reply queued again. The saved message and destination will be used.</p> : null}
    {automationId ? query.isLoading ? <p role="status" className="mt-4 text-sm">Loading delivery history…</p>
      : query.isError ? <p role="alert" className="mt-4 text-sm text-red-700">Could not load deliveries. <button type="button" className="underline" onClick={() => void query.refetch()}>Try again</button></p>
        : !items.length ? <p className="mt-4 text-sm text-[var(--k-muted)]">No matching comments have queued a reply yet.</p>
          : <ul className="mt-4 grid gap-3">{items.map(item => <li key={item.id} className="rounded-xl border border-[#eceee9] p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-extrabold">{item.status === 'UNKNOWN' ? 'Unconfirmed' : item.status.toLowerCase().replace(/^./, char => char.toUpperCase())}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div>
            {item.errorCode ? <p className="mt-2 text-[var(--k-muted)]">{reasons[item.errorCode] ?? 'Instagram could not complete this reply. Check the account connection and permissions.'}</p> : null}
            {item.status === 'UNKNOWN' ? <p className="mt-2 text-amber-800">This reply may already have been delivered. It will not be sent again.</p> : null}
            {item.status === 'PENDING' && new Date(item.nextAttemptAt) > new Date() ? <p className="mt-2">Next attempt after {new Date(item.nextAttemptAt).toLocaleTimeString()}</p> : null}
            {item.sentAt ? <p className="mt-2 text-[var(--k-muted)]">Sent {new Date(item.sentAt).toLocaleString()} · {item.clicks} link clicks</p> : null}
            {item.canRetry ? <button type="button" disabled={!canRetry || retry.isPending} className="mt-3 font-extrabold text-[#718c1b] underline" onClick={() => retry.mutate(item.id)}>{retry.isPending && retry.variables === item.id ? 'Queueing…' : 'Retry confirmed failure'}</button> : null}
          </li>)}</ul> : null}
    {query.hasNextPage ? <button type="button" className="k-btn-line mt-4 !h-9 text-xs" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load older replies</button> : null}
  </section>;
}
