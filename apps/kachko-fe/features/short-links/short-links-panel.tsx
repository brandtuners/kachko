"use client";

import { useState, type FormEvent } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ShortLink, ShortLinkList, ShortLinkStats } from "@kachko/types";
import { apiFetch } from "../../lib/api";
import { PageQr } from "../share/page-qr";

type LinkInput = { title?: string; destinationUrl: string; code?: string; channel?: string; tags?: string[]; utm?: ShortLink['utm'] };

export function ShortLinksPanel() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const query = useInfiniteQuery({ queryKey: ["short-links"], initialPageParam: "",
    queryFn: ({ pageParam }) => apiFetch<ShortLinkList>(`/short-links${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: page => page.nextCursor ?? undefined });
  const create = useMutation({ mutationFn: (input: LinkInput) => apiFetch<ShortLink>("/short-links", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => { setCreating(false); void qc.invalidateQueries({ queryKey: ["short-links"] }); } });
  const links = query.data?.pages.flatMap(page => page.items) ?? [];
  const needle = search.toLowerCase();
  const visible = links.filter(link => [link.title, link.destinationUrl, link.code, link.channel, ...link.tags].some(value => value?.toLowerCase().includes(needle)));

  return <section>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-[26px] font-extrabold tracking-[-1px]">Link shortener</h1><p className="mt-1 text-sm text-[var(--k-muted)]">Short links for every campaign. Edit destinations and see what gets clicked.</p></div>
      <button type="button" className="k-btn-ink !rounded-full" onClick={() => { create.reset(); setCreating(value => !value); }}>{creating ? "Cancel" : "+ Create short link"}</button>
    </div>
    {creating ? <div className="k-panel mb-5 p-5"><h2 className="mb-4 text-sm font-extrabold">Create a short link</h2><ShortLinkForm pending={create.isPending} error={create.error?.message} onSubmit={input => create.mutate(input)} /></div> : null}
    <div className="k-panel p-5">
      <label className="sr-only" htmlFor="short-link-search">Search loaded short links</label>
      <input id="short-link-search" className="k-input mb-4" type="search" placeholder="Search links, channels or tags…" value={search} onChange={event => setSearch(event.target.value)} />
      {query.isLoading ? <p role="status" className="py-10 text-center text-sm text-[var(--k-muted)]">Loading short links…</p>
        : query.isError ? <div role="alert" className="py-8 text-center"><p className="text-sm text-red-700">Could not load short links.</p><button className="k-btn-line mt-3" onClick={() => void query.refetch()}>Try again</button></div>
        : !visible.length ? <div className="py-10 text-center"><p className="font-extrabold">{links.length ? "No matching links" : "Your next click starts here"}</p><p className="mt-2 text-sm text-[var(--k-muted)]">{links.length ? "Try another search or load more links." : "Create a short URL for a product, post, newsletter or anything you want to share."}</p></div>
        : <div className="grid gap-3">{visible.map(link => <ShortLinkCard key={link.id} link={link} />)}</div>}
      {query.hasNextPage ? <button type="button" className="k-btn-line mt-5 w-full" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading…" : "Load more links"}</button> : null}
    </div>
  </section>;
}

function ShortLinkForm({ initial, pending, error, onSubmit }: { initial?: ShortLink; pending: boolean; error?: string; onSubmit: (input: LinkInput) => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.destinationUrl ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [channel, setChannel] = useState(initial?.channel ?? "");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [utm, setUtm] = useState<ShortLink['utm']>(initial?.utm ?? {});
  const effectiveUtm = Object.fromEntries(Object.entries(utm).filter(([, value]) => value?.trim()).map(([key, value]) => [key, value!.trim()]));
  let preview = url;
  try {
    const destination = new URL(url);
    for (const [key, value] of Object.entries(effectiveUtm)) destination.searchParams.set(`utm_${key}`, value);
    preview = destination.href;
  } catch { /* Incomplete URL while typing; validation happens on the API. */ }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ title, destinationUrl: url, ...(code ? { code } : {}), channel, tags: [...new Set(tags.split(",").map(value => value.trim()).filter(Boolean))], utm: effectiveUtm });
  };
  return <form className="grid gap-3" onSubmit={submit}>
    <label className="grid gap-1 text-xs font-bold">Destination URL<input type="url" className="k-input" required maxLength={2048} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com/your-long-link" /></label>
    <label className="grid gap-1 text-xs font-bold">Title <span className="sr-only">(optional)</span><input className="k-input" maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="Summer launch" /></label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-bold">Custom back-half <span className="font-normal text-[var(--k-muted)]">(optional)</span><input className="k-input" maxLength={48} minLength={3} pattern="[A-Za-z0-9_-]+" value={code} onChange={event => setCode(event.target.value)} placeholder="summer-launch" /></label>
      <label className="grid gap-1 text-xs font-bold">Channel <span className="font-normal text-[var(--k-muted)]">(optional)</span><input className="k-input" maxLength={80} value={channel} onChange={event => setChannel(event.target.value)} placeholder="Instagram" /></label>
    </div>
    <label className="grid gap-1 text-xs font-bold">Tags <span className="font-normal text-[var(--k-muted)]">(comma separated, up to 20)</span><input className="k-input" value={tags} onChange={event => setTags(event.target.value)} placeholder="summer, launch, newsletter" /></label>
    <fieldset className="grid gap-3 rounded-xl border border-[#e5e8df] p-3"><legend className="px-1 text-xs font-extrabold">Campaign tracking (optional)</legend>
      <p className="text-xs text-[var(--k-muted)]">Add UTM parameters to the destination without changing the short link. Values here replace matching parameters already in the URL.</p>
      <div className="grid gap-3 sm:grid-cols-2">{(['source', 'medium', 'campaign', 'term', 'content'] as const).map(key => <label key={key} className="grid gap-1 text-xs font-bold capitalize">{key}<input className="k-input" maxLength={120} value={utm[key] ?? ''} onChange={event => setUtm(current => ({ ...current, [key]: event.target.value }))} placeholder={key === 'source' ? 'instagram' : key === 'medium' ? 'social' : key === 'campaign' ? 'summer-launch' : ''} /></label>)}</div>
      <p className="break-all text-[11px] text-[var(--k-muted)]">Destination preview: {preview || 'Enter a URL above'}</p>
    </fieldset>
    {initial && code !== initial.code ? <p className="text-xs text-[#718c1b]">Your previous short URL and QR code will keep working after this change.</p> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    <button className="k-btn-ink !rounded-full sm:justify-self-start" disabled={pending}>{pending ? "Saving…" : initial ? "Save changes" : "Create short link"}</button>
  </form>;
}

function ShortLinkCard({ link }: { link: ShortLink }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"edit" | "stats" | "qr" | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const mutation = useMutation({ mutationFn: (input: Partial<LinkInput> & { isActive?: boolean }) => apiFetch<ShortLink>(`/short-links/${link.id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => { setMode(null); void qc.invalidateQueries({ queryKey: ["short-links"] }); } });
  const toggle = (next: typeof mode) => { mutation.reset(); setMode(current => current === next ? null : next); };
  return <article className="overflow-hidden rounded-2xl border border-[#e5e8df] bg-white p-4">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-sm font-extrabold">{link.title || link.code}</h2><a className="mt-1 block truncate text-sm font-bold text-[#718c1b] hover:underline" href={link.shortUrl} target="_blank" rel="noopener noreferrer">{link.shortUrl}</a><p className="mt-1 truncate text-xs text-[var(--k-muted)]">{link.destinationUrl}</p></div><div className="shrink-0 text-right"><p className="text-xl font-extrabold">{link.clickCount.toLocaleString()}</p><span className="text-[10px] uppercase text-[var(--k-muted)]">total clicks</span></div></div>
    {(link.channel || link.tags.length) ? <div className="mt-3 flex flex-wrap gap-1.5">{link.channel ? <span className="rounded-full bg-[#eff8d4] px-2 py-0.5 text-[10px] font-bold">{link.channel}</span> : null}{link.tags.map(tag => <span key={tag} className="rounded-full bg-[#f3f4ef] px-2 py-0.5 text-[10px] text-[var(--k-muted)]">#{tag}</span>)}</div> : null}
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button className="k-btn-line !h-8 !rounded-full !px-3 text-xs" onClick={async () => { try { await navigator.clipboard.writeText(link.shortUrl); setCopied(true); setCopyError(false); } catch { setCopyError(true); } }}>{copied ? "Copied ✓" : "Copy link"}</button>
      <button className="k-btn-line !h-8 !rounded-full !px-3 text-xs" aria-expanded={mode === "edit"} onClick={() => toggle("edit")}>Edit</button>
      <button className="k-btn-line !h-8 !rounded-full !px-3 text-xs" aria-expanded={mode === "stats"} onClick={() => toggle("stats")}>Analytics</button>
      <button className="k-btn-line !h-8 !rounded-full !px-3 text-xs" aria-expanded={mode === "qr"} onClick={() => toggle("qr")}>QR code</button>
      <button className={`ml-auto rounded-full px-3 py-1.5 text-xs font-bold ${link.isActive ? "bg-[#eff8d4] text-[#617c16]" : "bg-[#f3f4ef] text-[#777c79]"}`} aria-pressed={link.isActive} disabled={mutation.isPending} onClick={() => mutation.mutate({ isActive: !link.isActive })}>{link.isActive ? "Active" : "Paused"}</button>
    </div>
    {copyError ? <p role="alert" className="mt-2 text-xs text-red-700">Could not copy. Select the short URL above to copy it manually.</p> : null}
    {mutation.error && mode !== "edit" ? <p role="alert" className="mt-2 text-xs text-red-700">{mutation.error.message}</p> : null}
    {mode ? <div className="mt-4 border-t border-[#eceee9] pt-4">{mode === "edit" ? <ShortLinkForm key={link.updatedAt} initial={link} pending={mutation.isPending} error={mutation.error?.message} onSubmit={input => mutation.mutate(input)} /> : mode === "qr" ? <PageQr url={link.shortUrl} username={link.code} size={160} /> : <ShortLinkAnalytics id={link.id} />}</div> : null}
  </article>;
}

function ShortLinkAnalytics({ id }: { id: string }) {
  const query = useQuery({ queryKey: ["short-link-stats", id], queryFn: () => apiFetch<ShortLinkStats>(`/short-links/${id}/stats`) });
  if (query.isLoading) return <p role="status" className="text-sm text-[var(--k-muted)]">Loading analytics…</p>;
  if (!query.data) return <p role="alert" className="text-sm text-red-700">Could not load analytics.</p>;
  const stats = query.data;
  const max = Math.max(1, ...stats.activity.map(item => item.clicks));
  return <div className="grid gap-4"><p className="text-sm font-extrabold">{stats.clicks.toLocaleString()} clicks in the last 30 days</p><div className="flex h-24 items-end gap-1" aria-label="Daily clicks in UTC">{stats.activity.map(item => <div key={item.date} className="flex h-full min-w-0 flex-1 items-end" title={`${item.date}: ${item.clicks} clicks`}><div className="w-full rounded-t bg-[var(--k-lime)]" style={{ height: `${Math.max(3, item.clicks / max * 100)}%` }} /></div>)}</div><div className="grid gap-4 sm:grid-cols-3">{[{ title: "Devices", values: stats.devices }, { title: "Sources", values: stats.sources }, { title: "Countries", values: stats.countries }].map(group => <div key={group.title}><p className="mb-2 text-xs font-extrabold uppercase text-[var(--k-muted)]">{group.title}</p>{group.values.length ? <ul className="grid gap-1.5">{group.values.map(item => <li key={item.label} className="flex min-w-0 justify-between gap-2 text-xs"><span className="truncate">{item.label}</span><span className="font-extrabold">{item.clicks}</span></li>)}</ul> : <p className="text-xs text-[var(--k-muted)]">No clicks yet</p>}</div>)}</div><p className="text-[10px] text-[var(--k-muted)]">Countries depend on your hosting provider. Sources may be unavailable when browsers hide the referrer.</p></div>;
}
