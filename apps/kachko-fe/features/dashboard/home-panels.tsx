"use client";

// Home panels (reference: kachko_dashboard.html) — hero, lime metric cards with
// REAL sparklines from /analytics, and the quick "Your Links" list. Every number
// on this screen comes from the analytics endpoints; nothing is decorative data.
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import type { AnalyticsDevice, AnalyticsGeo, AnalyticsPeriod, AnalyticsRange, AnalyticsReferrer,
  AnalyticsSeriesPoint, AnalyticsSummary, AnalyticsTopLink } from "@kachko/types";
import { useEditor } from "../editor/use-editor";
import type { EditorBlock } from "../editor/types";
import { BLOCK_ICONS, blockSub, blockTitle, PlatformBadge } from "./block-row";
import {
  IconChart,
  IconEye,
  IconLink,
  IconPhone,
  IconPlus,
  IconUsers,
} from "../../components/icons";


/** Shared analytics reads — same cache keys the Analytics tab uses, so the
 *  home metrics and the analytics panel are always the same truth. */
export function useStats(pageId: string, range: AnalyticsRange = "7d") {
  const options = { staleTime: 15_000, refetchInterval: 15_000, retry: 1 } as const;
  const summary = useQuery({
    queryKey: ["analytics", pageId, range, "summary"],
    queryFn: () => apiFetch<AnalyticsSummary>(`/pages/${pageId}/analytics/summary?range=${range}`),
    ...options,
  });
  const series = useQuery({
    queryKey: ["analytics", pageId, range, "timeseries"],
    queryFn: () => apiFetch<AnalyticsPeriod & { items: AnalyticsSeriesPoint[] }>(`/pages/${pageId}/analytics/timeseries?range=${range}`),
    ...options,
  });
  const top = useQuery({
    queryKey: ["analytics", pageId, range, "top-links"],
    queryFn: () => apiFetch<AnalyticsPeriod & { items: AnalyticsTopLink[] }>(`/pages/${pageId}/analytics/top-links?range=${range}`),
    ...options,
  });
  const referrers = useQuery({
    queryKey: ["analytics", pageId, range, "referrers"],
    queryFn: () => apiFetch<AnalyticsPeriod & { items: AnalyticsReferrer[] }>(`/pages/${pageId}/analytics/referrers?range=${range}`),
    ...options,
  });
  const geo = useQuery({
    queryKey: ["analytics", pageId, range, "geo"],
    queryFn: () => apiFetch<AnalyticsPeriod & { items: AnalyticsGeo[] }>(`/pages/${pageId}/analytics/geo?range=${range}`),
    ...options,
  });
  const devices = useQuery({
    queryKey: ["analytics", pageId, range, "devices"],
    queryFn: () => apiFetch<AnalyticsPeriod & { items: AnalyticsDevice[] }>(`/pages/${pageId}/analytics/devices?range=${range}`),
    ...options,
  });
  return { summary, series, top, referrers, geo, devices };
}

export function useClicksByBlock(pageId: string): Map<string, number> {
  const range: AnalyticsRange = "7d";
  const top = useQuery({
    queryKey: ["analytics", pageId, range, "top-links"],
    queryFn: () => apiFetch<AnalyticsPeriod & { items: AnalyticsTopLink[] }>(`/pages/${pageId}/analytics/top-links?range=${range}`),
    staleTime: 15_000, refetchInterval: 15_000, retry: 1,
  });
  const map = new Map<string, number>();
  for (const l of top.data?.items ?? []) map.set(l.blockId, l.clicks);
  return map;
}

/** Real time-series → polyline in a 74×37 box (the reference's sparkline). */
export function Spark({ values }: { values: number[] }) {
  const pts = values.slice(-12);
  if (pts.length < 2) {
    return (
      <svg viewBox="0 0 74 37" className="h-[37px] w-[74px]" aria-hidden>
        <line x1="2" y1="33" x2="72" y2="33" stroke="#dfe3d6" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />
      </svg>
    );
  }
  const max = Math.max(...pts, 1);
  const step = 70 / (pts.length - 1);
  const d = pts
    .map((v, i) => `${i === 0 ? "M" : "L"}${(2 + i * step).toFixed(1)} ${(33 - (v / max) * 28).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox="0 0 74 37" fill="none" stroke="#b9df48" strokeWidth="2" strokeLinecap="round" className="h-[37px] w-[74px]" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function MetricCard({
  icon,
  label,
  value,
  bottom,
  spark,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bottom: string;
  spark: number[];
}) {
  return (
    <div className="k-metric">
      <span className="k-metric-icon">{icon}</span>
      <p className="mt-3 text-[13px] text-[#737975]">{label}</p>
      <p className="mt-0.5 text-[26px] font-extrabold tracking-[-1px] text-[var(--k-ink)]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#77951a]">{bottom}</p>
      <span className="absolute bottom-[18px] right-[14px]">
        <Spark values={spark} />
      </span>
    </div>
  );
}

/** The four lime metric cards (reference `.metrics`). Values and sparklines are
 *  the actual last-7-days events; the bottom line is an honest derived stat. */
export function MetricsRow() {
  const editor = useEditor();
  const page = editor.page!;
  const { summary, series, devices } = useStats(page.id);
  if (summary.isError || series.isError || devices.isError) return <p role="alert">Analytics could not be loaded. Try again shortly.</p>;
  if (summary.isLoading || series.isLoading || devices.isLoading) return <div className="k-panel p-6 text-sm text-[#9a9f9b]">Loading analytics…</div>;
  const s = summary.data;
  const pts = series.data?.items ?? [];

  const clicks = (s?.linkClicks ?? 0) + (s?.socialClicks ?? 0);
  const views = s?.totalViews ?? 0;
  const mobileViews = devices.data?.items.find((item) => item.device === "mobile")?.visits ?? 0;
  const mobileShare = views > 0 ? Math.round((mobileViews / views) * 100) : 0;
  const ctr = s?.clickThroughRate ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      <MetricCard
        icon={<IconEye className="h-5 w-5" />}
        label="Views"
        value={fmt(views)}
        bottom={views > 0 ? `${fmt(Math.round(views / Math.max(pts.length, 1)))} per day avg` : "waiting for visitors"}
        spark={pts.map((p) => p.views)}
      />
      <MetricCard
        icon={<IconLink className="h-5 w-5" />}
        label="Total clicks"
        value={fmt(clicks)}
        bottom={views > 0 ? `${ctr}% of views clicked` : "no clicks yet"}
        spark={pts.map((p) => p.linkClicks + p.socialClicks)}
      />
      <MetricCard
        icon={<IconUsers className="h-5 w-5" />}
        label="Unique visitors"
        value={fmt(s?.uniqueVisitors ?? 0)}
        bottom="distinct people, 7 days"
        spark={[]}
      />
      <MetricCard
        icon={<IconPhone className="h-5 w-5" />}
        label="Mobile views"
        value={`${mobileShare}%`}
        bottom={views > 0 ? `${fmt(mobileViews)} of ${fmt(views)} views` : "no views yet"}
        spark={[]}
      />
    </div>
  );
}

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n);
}

/** "Your Links" — the reference row list, but backed by real blocks:
 *  name/url from block content, clicks from per-block analytics, toggle =
 *  isVisible, click the row to jump into the full editor. */
export function QuickLinks({ onOpen }: { onOpen: (blockId?: string) => void }) {
  const editor = useEditor();
  const page = editor.page!;
  const clicks = useClicksByBlock(page.id);
  const sorted = [...page.blocks].sort((a, b) => a.position - b.position).filter((b) => b.isVisible);

  return (
    <div className="k-panel mt-5 p-5">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[17px] font-extrabold tracking-[-.4px] text-[var(--k-ink)]">Your Links</h2>
        <button type="button" className="k-btn-ink" onClick={() => onOpen()}>
          <IconPlus className="h-4 w-4" />
          Add Link
        </button>
      </div>
      {sorted.length === 0 ? (
        <button
          type="button"
          onClick={() => onOpen()}
          className="mt-2 w-full rounded-[14px] border border-dashed border-[#dfe2dc] px-4 py-8 text-sm text-[#9a9f9b] transition hover:border-[#b5d936] hover:text-[#718c1b]"
        >
          No links yet — add your first one.
        </button>
      ) : (
        sorted.map((b) => <QuickLinkRow key={b.id} block={b} clicks={clicks.get(b.id)} onOpen={() => onOpen(b.id)} />)
      )}
      <p className="mt-3 text-[11px] text-[#9a9f9b]">Click a row to edit it · reorder and hide in the Links tab.</p>
    </div>
  );
}

function QuickLinkRow({ block, clicks, onOpen }: { block: EditorBlock; clicks: number | undefined; onOpen: () => void }) {
  const c = block.content as Record<string, unknown>;
  const Icon = block.type === "SOCIAL" ? null : BLOCK_ICONS[block.type] ?? IconLink;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-2 grid h-[62px] w-full grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border border-[#eceee9] bg-white px-3 text-left transition hover:border-[#b5d936] hover:shadow-[0_4px_14px_rgba(22,27,22,.05)]"
    >
      {block.type === "SOCIAL" ? (
        <PlatformBadge platform={String(c.platform ?? "")} />
      ) : (
        <span className="k-tile-icon">
          {Icon ? <Icon className="h-[18px] w-[18px]" /> : null}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-extrabold text-[var(--k-ink)]">{blockTitle(block)}</span>
        <span className="block truncate text-[10px] text-[#9a9f9b]">{blockSub(block)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-[#77951a]">
        <IconChart className="h-4 w-4 text-[#858a87]" />
        {clicks ? fmt(clicks) : "—"}
      </span>
    </button>
  );
}

/* ---- decorative hero bits from the reference (pure CSS/SVG, no data) ---- */

export function HeroArch() {
  return (
    <svg viewBox="0 0 126 154" className="pointer-events-none absolute -top-2 right-2 hidden w-[110px] opacity-75 lg:block xl:right-[42px] xl:w-[126px]" aria-hidden>
      <defs>
        <linearGradient id="k-arch-lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c8f24a" stopOpacity=".9" />
          <stop offset="1" stopColor="#c8f24a" stopOpacity=".08" />
        </linearGradient>
      </defs>
      <path d="M14 154V61C14 25 35 8 63 8s49 17 49 53v93H91V61c0-18-10-28-28-28S35 43 35 61v93Z" fill="url(#k-arch-lg)" />
    </svg>
  );
}

/** Fixed bottom-left ridgeline, straight from the reference. Pure decoration. */
export function MountainArt() {
  return (
    <div aria-hidden className="pointer-events-none fixed bottom-0 left-[-8px] z-0 hidden w-[300px] opacity-[.26] xl:block">
      <div className="relative h-[310px] w-full">
        <span className="absolute -bottom-[35px] left-0 h-[150px] w-[330px] rotate-[7deg] rounded-t-full bg-[#c4ccb0]" style={{ borderRadius: "50% 50% 0 0 / 80% 80% 0 0" }} />
        <span className="absolute -bottom-[45px] left-[80px] h-[150px] w-[330px] -rotate-[12deg] bg-[#dce0d1]" style={{ borderRadius: "50% 50% 0 0 / 80% 80% 0 0" }} />
        <span className="absolute bottom-[80px] left-[75px] h-[135px] w-[92px] rounded-t-[70px] border-[7px] border-b-0 border-[#aebc8a]" />
        <span className="absolute bottom-[74px] left-[115px] h-[38px] w-[11px] rounded-lg bg-[#626b58]">
          <span className="absolute -top-[11px] left-[1px] h-[9px] w-[9px] rounded-full bg-[#626b58]" />
        </span>
      </div>
    </div>
  );
}
