"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowUpRight } from "../../components/icons";
import { useEditor } from "../../features/editor/use-editor";
import { HeroArch, MetricsRow, QuickLinks } from "../../features/dashboard/home-panels";

export default function DashboardHomePage() {
  const editor = useEditor();
  const router = useRouter();
  const page = editor.page;
  if (!page) return null;
  const displayName = page.user.displayName ?? page.user.username;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = displayName.split(" ")[0] ?? displayName;
  return <>
    <div className="relative min-h-[150px] overflow-hidden">
      <HeroArch />
      <div className="relative z-[2]">
        <p className="k-eyebrow">{greeting}, {firstName}</p>
        <h1 className="text-4xl font-extrabold leading-[1.05] tracking-[-2px] text-[var(--k-ink)] sm:text-[44px]">Build a <span className="text-[#7e952b]">brighter</span> you.</h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--k-muted)]">Add links, customize your page and share it with the world.</p>
        {page.isPublished ? <Link href={`/${page.user.username}${page.isPrimary ? "" : `/${page.slug}`}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-extrabold text-[#718c1b] hover:underline">kachko.in/{page.user.username}{page.isPrimary ? "" : `/${page.slug}`}<IconArrowUpRight className="h-4 w-4" /></Link> : <p className="mt-4 text-sm font-extrabold text-[#b45309]">Your page is still a draft</p>}
      </div>
    </div>
    {!page.isPublished ? <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-amber-200 bg-amber-50 px-5 py-4"><p className="text-sm font-semibold text-amber-800">Your page is a <strong>draft</strong> — visitors get a 404 until you publish it.</p><button type="button" className="k-btn-ink !bg-amber-600" disabled={editor.saveMeta.isPending} onClick={() => editor.saveMeta.mutate({ isPublished: true })}>{editor.saveMeta.isPending ? "Publishing…" : "Publish page"}</button></div> : null}
    <div className="mt-8"><MetricsRow /></div>
    <QuickLinks onOpen={() => router.push("/dashboard/links")} />
  </>;
}
