"use client";

// Main Dashboard (reference: kachko_dashboard.html — cream/lime/Manrope).
// Not a one-page scroll: the floating dock switches panels —
//   Home      → hero + lime metric cards (real sparklines) + Your Links quick list
//   Links     → full block editor (add / reorder / hide / inline-edit / delete)
//   Design    → theme swatches (instant restyle)
//   Analytics → charts + breakdowns, 15s refresh
//   Settings  → profile, avatar, socials, publish
// My QR and View-my-page live in the top bar. The sticky preview card on the
// right mirrors the public page live, with a phone ↔ desktop toggle.
import { useRef, useState } from "react";
import Link from "next/link";
import type { AnalyticsRange } from "@kachko/types";
import { isAuthError } from "../../features/editor/api";
import { apiFetch } from "../../lib/api";
import { useEditor } from "../../features/editor/use-editor";
import { useMediaUpload } from "../../features/editor/use-media-upload";
import { BLOCK_LABELS, BLOCK_TYPES, SOCIAL_PLATFORMS, type BlockType } from "../../features/editor/types";
import { Avatar, BottomDock, TopNav, type DashTab } from "../../features/dashboard/dash-chrome";
import { BLOCK_ICONS, DashBlockRow } from "../../features/dashboard/block-row";
import { PhonePreview } from "../../features/dashboard/phone-preview";
import { DesignPanel } from "../../features/dashboard/design-panel";
import { HeroArch, MetricsRow, QuickLinks, MountainArt, useClicksByBlock, useStats } from "../../features/dashboard/home-panels";
import {
  IconArrowUpRight,
  IconCheck,
  IconChart,
  IconEye,
  IconLink,
  IconPlus,
  IconQr,
  IconTrash,
} from "../../components/icons";
import { SOCIAL_ICONS } from "../../components/icons";
import { ObLogo } from "../../features/onboarding/ob-shell";
import { PageQr } from "../../features/share/page-qr";
import { publicPageUrl } from "../../lib/public-url";

export default function DashboardPage() {
  const editor = useEditor();
  const [tab, setTab] = useState<DashTab>("home");
  // Jump target from QuickLinks ("edit this block") — carried into the Links tab.
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);

  if (editor.isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#fbfaf6] text-[#171918]">
        <div className="flex flex-col items-center gap-3 text-[#777c79]">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#e3e6de] border-t-[#111312]" />
          Loading your dashboard…
        </div>
      </main>
    );
  }

  if (editor.isError || !editor.page) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#fbfaf6] px-6 text-center">
        <ObLogo />
        <h1 className="text-2xl font-bold text-[#111312]">We couldn&apos;t load your page</h1>
        <p className="text-[#777c79]" role="alert">
          {isAuthError(editor.error) ? "Your session expired. Please sign in again." : editor.error?.message ?? "Please try loading your page again."}
        </p>
        {isAuthError(editor.error) ? (
          <Link href="/login" className="k-btn-ink !rounded-full !px-6 !py-3">Go to login</Link>
        ) : (
          <button type="button" onClick={() => editor.refetch()} className="k-btn-ink !rounded-full !px-6 !py-3">Try again</button>
        )}
      </main>
    );
  }

  const page = editor.page;
  const displayName = page.user.displayName ?? page.user.username;
  const go = (t: DashTab) => {
    setTab(t);
    if (t !== "blocks") setFocusBlockId(null);
  };
  const openEditor = (blockId?: string) => {
    setFocusBlockId(blockId ?? null);
    setTab("blocks");
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = displayName.split(" ")[0] ?? displayName;

  return (
    <div className="relative min-h-dvh pb-28">
      <MountainArt />
      <TopNav tab={tab} go={go} isPublished={page.isPublished} />

      <div className="relative z-10 mx-auto grid w-full max-w-[1380px] gap-[52px] px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-[40px]">
        {/* ------------------------------------------------ left: panel area */}
        <main className="min-w-0">
          {tab === "home" && (
            <>
              {/* Hero (reference): eyebrow + big statement + hand note + arch */}
              <div className="relative min-h-[150px] overflow-hidden">
                <HeroArch />
                <div className="relative z-[2]">
                  <p className="k-eyebrow">
                    {greeting}, {firstName}
                  </p>
                  <h1 className="text-4xl font-extrabold leading-[1.05] tracking-[-2px] text-[var(--k-ink)] sm:text-[44px]">
                    Build a <span className="text-[#7e952b]">brighter</span> you.
                  </h1>
                  <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--k-muted)]">
                    Add links, customize your page and share it with the world.
                  </p>
                  {page.isPublished ? (
                    <Link href={`/@${page.user.username}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-extrabold text-[#718c1b] hover:underline">
                      kachko.app/@{page.user.username}
                      <IconArrowUpRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <p className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-[#b45309]">
                      Your page is still a draft
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                        Publish below
                      </span>
                    </p>
                  )}
                </div>
                <div className="k-hero-note hidden xl:block">
                  One link
                  <br />
                  for a brighter you.
                  <span aria-hidden className="absolute -bottom-[9px] left-[35px] h-[2px] w-[82px] rotate-[-5deg] bg-[#b9df25]" />
                </div>
              </div>

              {/* Draft banner — visitors 404 until published */}
              {!page.isPublished ? (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-amber-200 bg-amber-50 px-5 py-4">
                  <p className="text-sm font-semibold text-amber-800">
                    Your page is a <strong>draft</strong> — visitors get a 404 until you publish it.
                  </p>
                  <button
                    type="button"
                    className="k-btn-ink !bg-amber-600 hover:!bg-amber-500"
                    disabled={editor.saveMeta.isPending}
                    onClick={() => editor.saveMeta.mutate({ isPublished: true })}
                  >
                    {editor.saveMeta.isPending ? "Publishing…" : "Publish page"}
                  </button>
                </div>
              ) : null}

              {/* Metrics — all four from the live analytics pipeline */}
              <div className="mt-8">
                <MetricsRow />
              </div>

              {/* Your Links — quick list; rows jump into the editor */}
              <QuickLinks onOpen={openEditor} />
            </>
          )}
          {tab === "blocks" && <BlocksPanel focusId={focusBlockId} clearFocus={() => setFocusBlockId(null)} />}
          {tab === "qr" && <QrPanel />}
          {tab === "appearance" && <AppearancePanel />}
          {tab === "analytics" && <AnalyticsPanel />}
          {tab === "links" && <LinksPanel />}

          <footer className="pb-4 pt-12 text-center text-xs text-[#9a9f9b] lg:text-left">
            {displayName} · kachko.app/@{page.user.username} — Powered by{" "}
            <span className="font-extrabold text-[#718c1b]">Kachko</span>
          </footer>
        </main>

        {/* --------------------------------- right: fixed mobile preview */}
        {/* On phones the preview stacks on top; on desktop it pins to the
            right and follows scroll (reference `.preview-wrap`). */}
        <aside className="order-first pb-2 lg:order-none lg:pb-0">
          <div className="lg:sticky lg:top-[102px]">
            <PhonePreview page={page} isPublished={page.isPublished} />
          </div>
        </aside>
      </div>

      <BottomDock tab={tab} go={go} />
    </div>
  );
}

/* ================================================================ PANELS */

function Panel({ title, sub, action, children }: { title: string; sub?: string; action?: JSX.Element; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[26px] font-extrabold tracking-[-1px] text-[var(--k-ink)]">{title}</h2>
          {sub ? <p className="mt-1 text-sm text-[var(--k-muted)]">{sub}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/* -------------------------------------------------- Links (block editor) */

function BlocksPanel({ focusId, clearFocus }: { focusId: string | null; clearFocus: () => void }) {
  const editor = useEditor();
  const upload = useMediaUpload();
  const imageInput = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const page = editor.page!;
  const clicks = useClicksByBlock(page.id);
  const sorted = [...page.blocks].sort((a, b) => a.position - b.position);
  const editingId = justAddedId ?? focusId;

  const moveTo = (from: number, to: number) => {
    if (from === to || to < 0 || to >= sorted.length) return;
    const ordered = sorted.map((b) => b.id);
    const [moved] = ordered.splice(from, 1);
    if (!moved) return;
    ordered.splice(to, 0, moved);
    editor.moveBlock.mutate(ordered);
    setDragIndex(null);
  };

  // Adding a block: the API validates content per type, so every new block is
  // created with schema-valid defaults and dropped straight into edit mode.
  const addBlock = (t: BlockType) => {
    setAddError(null);
    const content = libraryDefaults(t);
    if (t === "IMAGE") { imageInput.current?.click(); return; }
    editor.createBlock.mutate(
      { type: t, content },
      {
        onSuccess: (b) => setJustAddedId(b.id),
        onError: (e) => setAddError(e.message || "Couldn't add that block."),
      },
    );
  };

  return (
    <Panel title="Links" sub="Build your page, block by block.">
      <div className="grid gap-5">
        {/* Your blocks */}
        <div className="k-panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="k-label !mb-0">Your blocks</p>
            <button type="button" className="k-btn-ink !h-9 !rounded-full !px-4 text-xs" onClick={() => addBlock("LINK")}>
              <IconPlus className="h-3.5 w-3.5" />
              New block
            </button>
          </div>
          {sorted.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-[#dfe2dc] px-4 py-10 text-center text-sm text-[#9a9f9b]">
              No blocks yet. Press “+ New block” to add your first one.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {sorted.map((b, i) => (
                <DashBlockRow
                  key={b.id}
                  block={b}
                  index={i}
                  count={sorted.length}
                  clicks={clicks.get(b.id)}
                  isDragging={dragIndex === i}
                  onDragStartItem={setDragIndex}
                  onDropItem={(to) => dragIndex !== null && moveTo(dragIndex, to)}
                  onDragEndItem={() => setDragIndex(null)}
                  startEditing={editingId === b.id}
                  onEditingChange={editingId === b.id ? (v) => { if (!v) { clearFocus(); setJustAddedId(null); } } : undefined}
                />
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-[#9a9f9b]">Drag rows to reorder — or use ↑ ↓ (keyboard-friendly).</p>
        </div>

        {/* Blocks library — pick a type to create */}
        <div className="k-panel p-5">
          <p className="k-label">Blocks library</p>
          <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
            onChange={async event => {
              const file = event.target.files?.[0]; event.target.value = "";
              if (!file) return;
              const media = await upload.uploadImage(file);
              if (!media) { setAddError(upload.error ?? "Image upload failed"); return; }
              editor.createBlock.mutate({ type: "IMAGE", content: { mediaId: media.id, alt: file.name } }, {
                onSuccess: block => setJustAddedId(block.id), onError: error => setAddError(error.message),
              });
            }} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BLOCK_TYPES.map((t) => {
              const Icon = BLOCK_ICONS[t] ?? IconLink;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => addBlock(t)}
                  disabled={editor.createBlock.isPending || upload.isUploading}
                  className="group flex flex-col items-start gap-2 rounded-[14px] border border-[#eceee9] bg-white p-3.5 text-left transition hover:border-[#b5d936] hover:shadow-[0_8px_24px_rgba(22,27,22,.06)] disabled:opacity-50"
                >
                  <span className="k-tile-icon transition group-hover:bg-[var(--k-ink)] group-hover:text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-extrabold text-[var(--k-ink)]">{BLOCK_LABELS[t]}</span>
                  <span className="text-[11px] leading-snug text-[#9a9f9b]">{LIBRARY_HINTS[t]}</span>
                </button>
              );
            })}
          </div>
          {addError ? <p className="mt-3 text-xs font-semibold text-[#b4322c]">{addError}</p> : null}
          {justAddedId ? <p className="mt-3 text-xs text-[#9a9f9b]">New block added above — fill in its details and Save.</p> : null}
        </div>
      </div>
    </Panel>
  );
}

const LIBRARY_HINTS: Record<BlockType, string> = {
  LINK: "A button to any URL",
  TEXT: "A line or two of copy",
  IMAGE: "Show off artwork",
  SOCIAL: "Inline social handle",
  DIVIDER: "Visual breathing room",
  YOUTUBE: "Embed a video",
  SPOTIFY: "Embed a track or playlist",
  EMAIL: "One-tap email button",
  PHONE: "One-tap call button",
  LOCATION: "Map pin",
};

function libraryDefaults(t: BlockType): Record<string, unknown> {
  // Must satisfy the API's per-type block-content validation (zod schemas in
  // @kachko/validation) — these are placeholder values the new row opens
  // straight into edit mode to replace.
  switch (t) {
    case "LINK":
      return { title: "My link", url: "https://example.com" };
    case "TEXT":
      return { text: "New text", alignment: "center" };
    case "IMAGE":
      return { mediaId: "", alt: "New image" };
    case "SOCIAL":
      return { platform: "INSTAGRAM", username: "your-handle" };
    case "DIVIDER":
      return {};
    case "YOUTUBE":
      return { videoId: "dQw4w9WgXcQ" };
    case "SPOTIFY":
      return { url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" };
    case "EMAIL":
      return { email: "you@example.com" };
    case "PHONE":
      return { number: "+1 555 0100" };
    case "LOCATION":
      return { query: "Your city" };
  }
}

/* ------------------------------------------------------------------ My QR */

function QrPanel() {
  const editor = useEditor();
  const page = editor.page!;
  const url = typeof window !== "undefined" ? publicPageUrl(page.user.username, window.location.origin) : "";
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Panel title="My QR" sub="Print-ready code that opens your page.">
      <div className="k-panel flex flex-col items-center gap-6 p-8 sm:flex-row">
        <PageQr url={url} username={page.user.username} size={190} />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-sm font-extrabold text-[var(--k-ink)]">@{page.user.username}</p>
          <code className="mt-1 block truncate text-sm text-[var(--k-muted)]">{url}</code>
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            
            <button type="button" onClick={copy} className="k-btn-line !rounded-full">
              {copied ? <IconCheck className="h-4 w-4" /> : <IconQr className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
          <p className="mt-4 text-xs text-[#9a9f9b]">
            Works at any size — drop it on posters, cards, or video overlays.
          </p>
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------- Design */

function AppearancePanel() {
  return (
    <Panel title="Design" sub="Shape every visual detail of your page.">
      <div className="k-panel p-4 sm:p-6">
        <DesignPanel />
      </div>
    </Panel>
  );
}
function AnalyticsPanel() {
  const editor = useEditor();
  const page = editor.page!;
  const [range, setRange] = useState<AnalyticsRange>("7d");
  const stats = useStats(page.id, range);
  const { summary, series, top, topSocials, referrers, geo, devices } = stats;
  const queries = [summary, series, top, topSocials, referrers, geo, devices];

  const s = summary.data;
  const points = series.data?.items ?? [];
  const empty = Boolean(s) && s!.totalViews === 0 && s!.linkClicks === 0 && s!.socialClicks === 0;
  const loading = queries.some((query) => query.isLoading);
  const failed = queries.some((query) => query.isError);
  const refreshing = queries.some((query) => query.isFetching);
  const maxActivity = Math.max(1, ...points.map((point) => point.views + point.linkClicks + point.socialClicks));
  const rangeLabel = range === "today" ? "today" : range === "7d" ? "last 7 days" : "last 30 days";

  return (
    <Panel
      title="Analytics"
      sub={`Privacy-safe, first-party stats — ${rangeLabel}.`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-[#e2e5de] bg-white p-1" aria-label="Analytics date range">
            {(["today", "7d", "30d"] as const).map((value) => (
              <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${range === value ? "bg-[var(--k-ink)] text-white" : "text-[var(--k-muted)] hover:bg-[#f3f4ef]"}`}>
                {value === "today" ? "Today" : value === "7d" ? "7 days" : "30 days"}
              </button>
            ))}
          </div>
          <button type="button" className="k-btn-line !h-9 !rounded-full !px-4 text-xs" disabled={refreshing}
            onClick={() => queries.forEach((query) => void query.refetch())}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="k-panel p-10 text-center text-sm text-[#9a9f9b]">Loading stats…</div>
      ) : failed ? (
        <div className="k-panel flex flex-col items-center gap-3 p-10 text-center" role="alert">
          <p className="text-sm font-semibold text-[#b4322c]">We couldn&apos;t load analytics.</p>
          <p className="text-xs text-[#9a9f9b]">Check your connection and try again.</p>
          <button type="button" className="k-btn-line !rounded-full" onClick={() => queries.forEach((query) => void query.refetch())}>Try again</button>
        </div>
      ) : empty ? (
        <div className="k-panel flex flex-col items-center gap-3 p-10 text-center">
          <span className="k-tile-icon !h-12 !w-12 !rounded-full">
            <IconEye className="h-6 w-6" />
          </span>
          <p className="text-sm text-[var(--k-muted)]">
            No visits yet. Share <code className="font-bold text-[var(--k-ink)]">/@{page.user.username}</code> to start collecting stats.
          </p>
          <p className="max-w-sm text-xs text-[#9a9f9b]">
            Analytics starts when visitors open your published page and interact with its links.
          </p>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard value={s!.totalViews} label="Views" />
            <StatCard value={s!.linkClicks + s!.socialClicks} label="Clicks" />
            <StatCard value={s!.uniqueVisitors} label="Visitors" />
            <StatCard value={`${s!.clickThroughRate}%`} label="Link CTR" />
          </div>

          <div className="k-panel p-5">
            <p className="k-label">Activity</p>
            <div className="flex h-32 items-end gap-1 overflow-x-auto">
              {points.map((point) => {
                const total = point.views + point.linkClicks + point.socialClicks;
                const h = Math.max(4, (total / maxActivity) * 100);
                return (
                  <div key={point.date} className="flex h-full min-w-[8px] flex-1 flex-col items-center justify-end" title={`${new Date(`${point.date}T00:00:00Z`).toLocaleDateString()} · ${total} events`}>
                    <div className="w-full rounded-t bg-[var(--k-ink)]" style={{ height: `${h}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-[#9a9f9b]">
              {points.length > 1 ? (
                <>
                  <span>{new Date(`${points[0]!.date}T00:00:00Z`).toLocaleDateString()}</span>
                  <span>{new Date(`${points[points.length - 1]!.date}T00:00:00Z`).toLocaleDateString()}</span>
                </>
              ) : null}
            </div>
          </div>

          {(top.data?.items.length || topSocials.data?.items.length) ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {top.data?.items.length ? (
                <div className="k-panel p-5">
                  <p className="k-label">Top links</p>
                  <ul className="flex flex-col gap-2">
                    {top.data.items.map((link) => (
                      <li key={link.blockId} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <IconChart className="h-4 w-4 shrink-0 text-[#9a9f9b]" />
                          <span className="truncate text-[var(--k-text)]">{link.title}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-[var(--k-lime-soft)] px-2.5 py-0.5 text-xs font-extrabold text-[#718c1b]">{link.clicks}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {topSocials.data?.items.length ? (
                <div className="k-panel p-5">
                  <p className="k-label">Top social links</p>
                  <ul className="flex flex-col gap-2">
                    {topSocials.data.items.map((social) => {
                      const Icon = SOCIAL_ICONS[social.platform] ?? IconLink;
                      return (
                        <li key={social.targetId} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0 text-[#9a9f9b]" />
                            <span className="min-w-0">
                              <span className="block truncate text-[var(--k-text)]">{social.label}</span>
                              <span className="block text-[10px] font-bold uppercase tracking-wide text-[#9a9f9b]">{social.platform}</span>
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full bg-[var(--k-lime-soft)] px-2.5 py-0.5 text-xs font-extrabold text-[#718c1b]">{social.clicks}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {(devices.data?.items.length || referrers.data?.items.length || geo.data?.items.length) ? (
            <div className="grid gap-5 sm:grid-cols-3">
              <MiniBreakdown title="Devices" rows={(devices.data?.items ?? []).map((item) => ({ label: item.device, count: item.visits }))} />
              <MiniBreakdown title="Where they came from" rows={(referrers.data?.items ?? []).map((item) => ({ label: item.referrer, count: item.visits }))} />
              <MiniBreakdown title="Locations" rows={(geo.data?.items ?? []).map((item) => ({ label: item.city ? `${item.city}, ${item.country}` : item.country, count: item.visits }))} />
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

function MiniBreakdown({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className="k-panel p-5">
      <p className="k-label">{title}</p>
      <ul className="flex flex-col gap-2">
        {rows.slice(0, 5).map((r) => (
          <li key={r.label} className="text-xs">
            <div className="flex justify-between text-[var(--k-text)]">
              <span className="truncate">{r.label}</span>
              <span className="shrink-0 font-extrabold">{r.count}</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-[#eef0e9]">
              <div className="h-1 rounded-full bg-[#b5d936]" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatCard({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="k-metric !min-h-0 flex flex-col items-center justify-center px-4 py-6 text-center">
      <span className="text-3xl font-extrabold tracking-[-1px] text-[var(--k-ink)]">{value}</span>
      <span className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--k-muted)]">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------- Settings (profile) */

function LinksPanel() {
  const editor = useEditor();
  const upload = useMediaUpload();
  const page = editor.page!;

  const [name, setName] = useState(page.user.displayName ?? "");
  const [tagline, setTagline] = useState(page.title ?? "");
  const [bio, setBio] = useState(page.description ?? "");
  const [platform, setPlatform] = useState<string>(SOCIAL_PLATFORMS[0]!);
  const [socialUrl, setSocialUrl] = useState("");

  const saveProfile = () => {
    editor.saveMeta.mutate({ title: tagline, description: bio });
    apiFetch("/users/me", { method: "PATCH", body: JSON.stringify({ displayName: name }) }).then(
      () => editor.refetch(),
      () => {},
    );
  };

  return (
    <Panel title="Settings" sub="How you show up at the top of your page.">
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="k-panel p-6">
          <div className="flex items-center gap-4">
            <Avatar size={12} />
            <div className="flex flex-col gap-1.5">
              <label className="k-btn-line !h-9 cursor-pointer text-xs">
                {upload.isUploading ? "Uploading…" : "Change photo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  disabled={upload.isUploading}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) await upload.uploadAvatar(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {page.user.avatarUrl ? (
                <button type="button" className="text-xs font-semibold text-[#9a9f9b] hover:text-[#b4322c]" onClick={upload.removeAvatar}>
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          {upload.error ? <p className="mt-2 text-sm text-[#b4322c]">{upload.error}</p> : null}

          <div className="mt-5 grid gap-4">
            <div>
              <label className="k-label" htmlFor="dash-name">Display name</label>
              <input id="dash-name" className="k-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="k-label" htmlFor="dash-tagline">Tagline</label>
              <input id="dash-tagline" className="k-input" value={tagline} maxLength={80} onChange={(e) => setTagline(e.target.value)} placeholder="What your page is about" />
            </div>
            <div>
              <label className="k-label" htmlFor="dash-bio">Bio</label>
              <textarea id="dash-bio" className="k-input min-h-24 resize-y" value={bio} maxLength={500} onChange={(e) => setBio(e.target.value)} placeholder="A few words about you…" />
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => editor.saveMeta.mutate({ isPublished: !page.isPublished })}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                  page.isPublished ? "bg-[var(--k-lime-soft)] text-[#718c1b] hover:bg-[#e6f5c4]" : "bg-[#f2f2ec] text-[var(--k-muted)] hover:bg-[#e9ebe4]"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${page.isPublished ? "bg-[#8bc34a]" : "bg-[#b6bab4]"}`} />
                {page.isPublished ? "Published" : "Draft — publish"}
              </button>
              <button type="button" className="k-btn-ink !rounded-full" disabled={editor.saveMeta.isPending} onClick={saveProfile}>
                {editor.saveMeta.isPending ? "Saving…" : "Save profile"}
              </button>
            </div>
          </div>
        </div>

        <div className="k-panel p-6">
          <p className="k-label">Social links</p>
          <div className="flex flex-col gap-2">
            {page.socials.length === 0 ? <p className="text-sm text-[#9a9f9b]">No social links yet.</p> : null}
            {page.socials.map((soc) => {
              const Icon = SOCIAL_ICONS[soc.platform] ?? IconLink;
              return (
                <div key={soc.id} className="flex items-center gap-3 rounded-[14px] border border-[#eceee9] bg-white px-3 py-2.5">
                  <span className="k-tile-icon">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-[var(--k-ink)]">{soc.platform}</p>
                    <p className="truncate text-xs text-[var(--k-muted)]">{soc.url}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${soc.platform} link`}
                    className="k-icon-btn !h-8 !w-8 hover:!text-[#b4322c]"
                    onClick={() => editor.removeSocial.mutate(soc.id)}
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3 border-t border-[#eceee9] pt-5 sm:grid-cols-[auto_1fr_auto]">
            <select aria-label="Platform" className="k-input !w-auto" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {SOCIAL_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            <input
              aria-label="Profile URL"
              className="k-input"
              placeholder="https://…"
              value={socialUrl}
              onChange={(e) => setSocialUrl(e.target.value)}
            />
            <button
              type="button"
              className="k-btn-ink"
              disabled={!socialUrl.trim() || editor.createSocial.isPending}
              onClick={() => {
                editor.createSocial.mutate({ platform, url: socialUrl.trim() }, { onSuccess: () => setSocialUrl("") });
              }}
            >
              <IconPlus className="h-4 w-4" />
              Add link
            </button>
          </div>
        </div>

        <div className="xl:col-span-2 flex items-center justify-between gap-4 rounded-[18px] border border-[#e9ebe6] bg-white/[.94] px-5 py-4 shadow-[var(--k-shadow)]">
          <p className="text-sm text-[var(--k-muted)]">
            {page.isPublished
              ? "See the real thing — your page is live for anyone with the link."
              : "Publish your page to make it visible to anyone with the link."}
          </p>
          <Link
            href={`/@${page.user.username}`}
            target="_blank"
            rel="noreferrer"
            className={`k-btn-line shrink-0 !rounded-full ${page.isPublished ? "" : "pointer-events-none opacity-50"}`}
          >
            View my page
            <IconArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <DeleteAccount />
      </div>
    </Panel>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    setDeleting(true); setError(null);
    try {
      await apiFetch("/users/me", { method: "DELETE", body: JSON.stringify({ confirmation, ...(password ? { password } : {}) }) });
      window.location.assign("/");
    } catch (value) {
      setDeleting(false);
      setError(value instanceof Error ? value.message : "Could not delete your account.");
    }
  };
  return (
    <div className="xl:col-span-2 rounded-[18px] border border-red-200 bg-red-50 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-extrabold text-red-900">Delete account</p><p className="mt-1 text-sm text-red-700">Permanently removes your page, media, sessions, and account data.</p></div>
        {!open ? <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700">Delete account</button> : null}
      </div>
      {open ? <div className="mt-4 grid max-w-md gap-3">
        <input className="k-input" type="password" autoComplete="current-password" placeholder="Current password (email accounts)" value={password} onChange={event => setPassword(event.target.value)} />
        <input className="k-input" placeholder="Type DELETE to confirm" value={confirmation} onChange={event => setConfirmation(event.target.value)} />
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="flex gap-2"><button type="button" disabled={confirmation !== "DELETE" || deleting} onClick={remove} className="rounded-full bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{deleting ? "Deleting…" : "Permanently delete"}</button><button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm">Cancel</button></div>
      </div> : null}
    </div>
  );
}
