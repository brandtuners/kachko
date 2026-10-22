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
        <Link href={`/${page.user.username}${page.isPrimary ? "" : `/${page.slug}`}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-extrabold text-[#718c1b] hover:underline">kachko.in/{page.user.username}{page.isPrimary ? "" : `/${page.slug}`}<IconArrowUpRight className="h-4 w-4" /></Link>
      </div>
    </div>
    <div className="mt-8"><MetricsRow /></div>
    <QuickLinks onOpen={() => router.push("/dashboard/links")} />
  </>;
}
