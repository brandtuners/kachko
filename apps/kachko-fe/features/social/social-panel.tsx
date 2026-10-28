"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import { KACHKO_FEATURES, useBilling } from "../billing/use-billing";
import { type ConnectedSocialAccount, type SocialAccountAnalytics, socialDate, socialNumber } from "./social-types";

export function SocialPanel() {
  const qc = useQueryClient();
  const billing = useBilling();
  const canViewInsights = billing.has(KACHKO_FEATURES.ADVANCED_ANALYTICS);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const accounts = useQuery({ queryKey: ["social", "accounts"], queryFn: () => apiFetch<ConnectedSocialAccount[]>("/social/accounts"), refetchInterval: 10_000 });
  const status = useQuery({ queryKey: ["social", "status"], queryFn: () => apiFetch<{ instagramConfigured: boolean; youtubeConfigured: boolean }>("/social/status") });
  const selected = accounts.data?.find(account => account.id === selectedId) ?? accounts.data?.[0];
  const analytics = useQuery({ queryKey: ["social", "analytics", selected?.id], queryFn: () => apiFetch<SocialAccountAnalytics>(`/social/accounts/${selected!.id}/analytics?range=30d`), enabled: Boolean(selected) && canViewInsights });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("connected")) setNotice("Your social account is connected. Sync it to load the latest insights.");
    else if (params.has("error")) setNotice("The account connection was not completed. Please try connecting again.");
  }, []);
  const connect = useMutation({ mutationFn: (platform: "instagram" | "youtube") => apiFetch<{ url: string }>(`/social/connect/${platform}`, { method: "POST" }), onSuccess: result => window.location.assign(result.url) });
  const sync = useMutation({ mutationFn: (id: string) => apiFetch(`/social/accounts/${id}/sync`, { method: "POST" }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social"] }); setNotice("Your connected account has been synced."); } });
  const disconnect = useMutation({ mutationFn: (id: string) => apiFetch(`/social/accounts/${id}`, { method: "DELETE" }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social"] }); setNotice("Account disconnected. Connect it again whenever you are ready."); } });
  const error = connect.error ?? sync.error ?? disconnect.error;
  const data = analytics.data;
  const points = data?.history ?? [];
  const maxFollowers = Math.max(1, ...points.map(point => point.followers ?? 0));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const postingDays = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - (29 - index));
    const date = day.toISOString().slice(0, 10);
    return { date, count: (data?.media ?? []).filter(item => item.publishedAt.slice(0, 10) === date).length };
  });
  const engagementDays = Array.from({ length: 7 }, (_, weekday) => {
    const posts = (data?.media ?? []).filter(item => new Date(item.publishedAt).getUTCDay() === weekday
      && new Date(item.publishedAt) >= new Date(postingDays[0]!.date)
      && (item.likes !== null || item.comments !== null));
    const total = posts.reduce((sum, item) => sum + (item.likes ?? 0) + (item.comments ?? 0), 0);
    return { weekday, posts: posts.length, total, average: posts.length ? total / posts.length : 0 };
  });
  const bestDay = engagementDays.filter(day => day.total > 0).sort((a, b) => b.average - a.average)[0];
  const weekdayName = (weekday: number) => new Intl.DateTimeFormat(undefined, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + weekday)));
  return <section>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-[26px] font-extrabold tracking-[-1px]">Social insights</h1><p className="mt-1 text-sm text-[var(--k-muted)]">Connect your accounts to see audience growth and content performance.</p></div><Link href="/dashboard/automations" className="k-btn-line">Instagram auto-replies ↗</Link></div>
    {notice ? <p role="status" className="mb-4 rounded-xl border border-[#dce8bc] bg-[#f2f8e5] p-3 text-sm">{notice}</p> : null}
    {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message}</p> : null}
    <div className="k-panel mb-5 p-5"><p className="k-label">Connected accounts</p>
      <div className="mb-4 flex flex-wrap gap-2">{([{ key: "instagram", name: "Instagram", configured: status.data?.instagramConfigured }, { key: "youtube", name: "YouTube", configured: status.data?.youtubeConfigured }] as const).map(provider => <button key={provider.key} type="button" className="k-btn-ink !h-10 !px-4 text-xs" disabled={!provider.configured || connect.isPending} title={!provider.configured ? `${provider.name} connections are not available yet` : undefined} onClick={() => connect.mutate(provider.key)}>{connect.isPending && connect.variables === provider.key ? "Connecting…" : `Connect ${provider.name}`}</button>)}</div>
      {status.isError ? <p role="alert" className="mb-3 text-sm text-red-700">Could not check available connections. <button type="button" className="underline" onClick={() => void status.refetch()}>Try again</button></p> : null}
      {status.data && (!status.data.instagramConfigured || !status.data.youtubeConfigured) ? <p className="mb-4 text-xs text-[var(--k-muted)]">Unavailable connection buttons will be enabled when the account integration is configured by Kachko.</p> : null}
      <p className="mb-4 text-xs text-[var(--k-muted)]">Instagram requires a professional account. You stay in control and can disconnect an account at any time.</p>
      {accounts.isLoading ? <p role="status" className="py-4 text-sm text-[var(--k-muted)]">Loading accounts…</p> : accounts.isError ? <p role="alert" className="py-4 text-sm text-red-700">Could not load accounts. <button type="button" className="underline" onClick={() => void accounts.refetch()}>Try again</button></p> : !accounts.data?.length ? <div className="rounded-xl border border-dashed border-[#dfe2dc] p-6 text-center text-sm text-[var(--k-muted)]">Connect Instagram or YouTube to start collecting social insights. Your existing page-link stats are in <Link href="/dashboard/analytics" className="font-bold text-[#718c1b] underline">Analytics</Link>.</div> : <div className="grid gap-3">{accounts.data.map(account => <div key={account.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${selected?.id === account.id ? "border-[#b7d67d] bg-[#f8faef]" : "border-[#eceee9]"}`}>
        <button type="button" aria-pressed={selected?.id === account.id} className="min-w-0 text-left" onClick={() => setSelectedId(account.id)}><span className="block text-sm font-extrabold">@{account.username}</span><span className="text-xs text-[var(--k-muted)]">{account.platform === "INSTAGRAM" ? "Instagram" : "YouTube"} · {account.status === "RECONNECT_REQUIRED" ? "Reconnect required" : "Connected"}</span></button>
        <div className="flex flex-wrap gap-2">{account.status === "RECONNECT_REQUIRED" ? <button type="button" aria-label={`Reconnect ${account.platform === "INSTAGRAM" ? "Instagram" : "YouTube"} account ${account.username}`} className="k-btn-line !h-8 !px-3 text-xs" disabled={connect.isPending || !(account.platform === "INSTAGRAM" ? status.data?.instagramConfigured : status.data?.youtubeConfigured)} onClick={() => connect.mutate(account.platform === "INSTAGRAM" ? "instagram" : "youtube")}>Reconnect</button> : <button type="button" aria-label={`Sync ${account.username}`} className="k-btn-line !h-8 !px-3 text-xs" disabled={sync.isPending || !(account.platform === "INSTAGRAM" ? status.data?.instagramConfigured : status.data?.youtubeConfigured)} onClick={() => sync.mutate(account.id)}>{sync.isPending && sync.variables === account.id ? "Syncing…" : "Sync now"}</button>}<button type="button" aria-label={`Disconnect ${account.username}`} className="text-xs font-bold text-red-700 underline" disabled={disconnect.isPending} onClick={() => { if (window.confirm(`Disconnect @${account.username}? Its Instagram auto-replies will stop until it is connected again.`)) disconnect.mutate(account.id); }}>Disconnect</button></div>
      </div>)}</div>}
    </div>
    {selected && billing.isLoading ? <div className="k-panel p-8 text-center text-sm text-[var(--k-muted)]" role="status">Checking access to social insights…</div> : selected && !canViewInsights ? <div className="k-panel p-5"><h2 className="font-extrabold">Get more from your connected accounts</h2><p className="mt-2 text-sm text-[var(--k-muted)]">Unlock social audience growth, content performance, and posting insights with advanced analytics. You can still sync Instagram posts to use in auto-replies.</p><Link href="/dashboard/billing" className="k-btn-ink mt-4">Explore plans</Link></div> : selected ? <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-extrabold">@{selected.username}</h2><p className="text-xs text-[var(--k-muted)]">Last 30 days · Last synced: {socialDate(data?.lastSyncedAt ?? selected.lastSyncedAt)}</p></div><span className="text-xs text-[var(--k-muted)]">Missing metrics are shown as —</span></div>
      {analytics.isLoading ? <div className="k-panel p-8 text-center text-sm text-[var(--k-muted)]" role="status">Loading insights…</div> : analytics.isError ? <div className="k-panel p-5 text-sm" role="alert"><p className="text-red-700">{analytics.error.message}</p><button type="button" className="mt-3 font-bold underline" onClick={() => void analytics.refetch()}>Try again</button></div> : data ? <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[{ label: selected.platform === "YOUTUBE" ? "Subscribers" : "Followers", value: data.followers }, { label: "Audience change", value: data.followersChange }, { label: "Posts", value: data.posts }, { label: "Views", value: data.views }, { label: "Reach", value: data.reach }].map(metric => <div key={metric.label} className="k-panel p-4"><p className="text-2xl font-extrabold">{socialNumber(metric.value)}</p><p className="mt-1 text-xs text-[var(--k-muted)]">{metric.label}</p></div>)}</div>
        <div className="k-panel p-5"><p className="k-label">Audience history</p>{points.some(point => point.followers !== null) ? <><div className="flex h-32 items-end gap-1 overflow-x-auto" role="list" aria-label="Daily audience count">{points.map(point => <div key={point.date} className="flex h-full min-w-2 flex-1 items-end" role="listitem" aria-label={`${point.date}: ${socialNumber(point.followers)}`} title={`${point.date}: ${socialNumber(point.followers)}`}><div className="w-full rounded-t bg-[#a5c943]" style={{ height: point.followers === null ? "0%" : `${Math.max(3, point.followers / maxFollowers * 100)}%` }} /></div>)}</div><div className="mt-2 flex justify-between text-[10px] text-[var(--k-muted)]"><span>{points[0]?.date.slice(0, 10)}</span><span>{points.at(-1)?.date.slice(0, 10)}</span></div></> : <p className="py-5 text-sm text-[var(--k-muted)]"><span className="mb-2 block text-2xl font-extrabold">—</span>Audience history starts with your first successful sync. Check back after another sync to see changes.</p>}</div>
        <div className="k-panel p-5"><p className="k-label">Posting frequency</p><p className="mb-4 text-xs text-[var(--k-muted)]">Synced content published during the last 30 days · Dates in UTC</p><div role="list" aria-label="Posts per day in the last 30 days" className="grid grid-cols-10 gap-2 sm:grid-cols-[repeat(15,minmax(0,1fr))]">{postingDays.map(day => <div key={day.date} role="listitem" aria-label={`${day.date}: ${day.count} synced ${day.count === 1 ? "post" : "posts"}`} title={`${day.date}: ${day.count} ${day.count === 1 ? "post" : "posts"}`} className={`aspect-square min-h-4 rounded ${day.count === 0 ? "bg-[#eef0e8]" : day.count === 1 ? "bg-[#d9e99e]" : day.count === 2 ? "bg-[#abc954]" : "bg-[#6f8d23]"}`}><span className="sr-only">{day.date}: {day.count} posts</span></div>)}</div><div className="mt-2 flex justify-between text-[10px] text-[var(--k-muted)]"><span>{postingDays[0]?.date}</span><span>{postingDays.at(-1)?.date}</span></div><div className="mt-4 flex items-center justify-end gap-1 text-[10px] text-[var(--k-muted)]"><span className="mr-1">Fewer</span>{["#eef0e8", "#d9e99e", "#abc954", "#6f8d23"].map(color => <span aria-hidden="true" key={color} className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />)}<span className="ml-1">More</span></div><div className="mt-4 rounded-xl bg-[#f7f8f3] p-3"><p className="text-xs font-extrabold">Highest average engagement</p>{bestDay ? <p className="mt-1 text-sm"><span className="font-extrabold">{weekdayName(bestDay.weekday)}</span> · {bestDay.average.toLocaleString(undefined, { maximumFractionDigits: 1 })} interactions per post across {bestDay.posts} synced {bestDay.posts === 1 ? "post" : "posts"}.</p> : <p className="mt-1 text-sm text-[var(--k-muted)]">— · No measured engagement yet.</p>}<p className="mt-1 text-[10px] text-[var(--k-muted)]">Based on available likes and comments from synced content in this period.</p></div></div>
        <section className="k-panel p-5" aria-labelledby="audience-demographics-title">
          <h2 id="audience-demographics-title" className="k-label">Audience demographics</h2>
          <p className="mb-4 text-xs text-[var(--k-muted)]">Follower counts supplied by the connected platform. Demographics may be restricted by account size or unavailable for this account.</p>
          <div className="grid gap-4 sm:grid-cols-3">{[{ title: "Countries", items: data.demographics?.countries }, { title: "Cities", items: data.demographics?.cities }, { title: "Gender", items: data.demographics?.genders }].map(group => <div key={group.title}>
            <h3 className="mb-2 text-sm font-extrabold">{group.title}</h3>
            {group.items?.length ? <dl className="grid gap-2">{group.items.map(item => <div key={item.label} className="flex items-start justify-between gap-3 text-xs"><dt className="min-w-0 break-words text-[var(--k-muted)]">{item.label}</dt><dd className="shrink-0 font-extrabold">{socialNumber(item.value)}</dd></div>)}</dl> : <p className="text-sm text-[var(--k-muted)]" aria-label={`${group.title}: unavailable`}>—</p>}
          </div>)}</div>
        </section>
        <div className="k-panel p-5"><p className="k-label">Recent content</p>{!data.media.length ? <p className="py-5 text-sm text-[var(--k-muted)]">No content has been synced yet.</p> : <div className="grid gap-3">{data.media.map(media => <article key={media.id} className="rounded-xl border border-[#eceee9] p-3"><div className="flex items-start justify-between gap-3"><p className="line-clamp-2 text-sm font-bold">{media.caption ?? `${media.mediaType} post`}</p>{media.permalink && /^https?:\/\//.test(media.permalink) ? <a href={media.permalink} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-bold text-[#718c1b] underline">View ↗</a> : null}</div><p className="mt-1 text-[10px] text-[var(--k-muted)]">{new Date(media.publishedAt).toLocaleDateString()} · {media.mediaType}</p><dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs"><div><dt className="inline text-[var(--k-muted)]">Likes </dt><dd className="inline font-bold">{socialNumber(media.likes)}</dd></div><div><dt className="inline text-[var(--k-muted)]">Comments </dt><dd className="inline font-bold">{socialNumber(media.comments)}</dd></div><div><dt className="inline text-[var(--k-muted)]">Views </dt><dd className="inline font-bold">{socialNumber(media.views)}</dd></div></dl></article>)}</div>}</div>
      </> : null}
    </div> : null}
  </section>;
}
