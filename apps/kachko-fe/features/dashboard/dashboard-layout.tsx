"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isAuthError } from "../editor/api";
import { useEditor } from "../editor/use-editor";
import { ObLogo } from "../onboarding/ob-shell";
import { MountainArt } from "./home-panels";
import { LivePreview } from "./phone-preview";
import { Header, Sidebar, type DashTab } from "./dash-chrome";

const ROUTES: Record<Exclude<DashTab, "qr">, string> = {
  home: "/dashboard", blocks: "/dashboard/links", appearance: "/dashboard/appearance",
  analytics: "/dashboard/analytics", links: "/dashboard/settings",
};

function tabFor(pathname: string): DashTab {
  if (pathname === "/dashboard/links") return "blocks";
  if (pathname === "/dashboard/appearance") return "appearance";
  if (pathname === "/dashboard/analytics") return "analytics";
  if (pathname === "/dashboard/settings") return "links";
  if (pathname === "/dashboard/qr") return "qr";
  return "home";
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const editor = useEditor();
  const pathname = usePathname();
  const router = useRouter();
  const tab = tabFor(pathname);
  const go = (next: DashTab) => router.push(next === "qr" ? "/dashboard/qr" : ROUTES[next]);

  if (editor.isLoading) return <main className="flex min-h-dvh items-center justify-center bg-[#fbfaf6]"><span className="h-8 w-8 animate-spin rounded-full border-2 border-[#e3e6de] border-t-[#111312]" /></main>;
  if (editor.isError || !editor.page) return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#fbfaf6] px-6 text-center"><ObLogo /><h1 className="text-2xl font-bold">We couldn&apos;t load your page</h1><p role="alert" className="text-[#777c79]">{isAuthError(editor.error) ? "Your session expired. Please sign in again." : editor.error?.message ?? "Please try again."}</p>{isAuthError(editor.error) ? <Link href="/login" className="k-btn-ink">Go to login</Link> : <button type="button" onClick={() => editor.refetch()} className="k-btn-ink">Try again</button>}</main>;

  const page = editor.page;
  const displayName = page.user.displayName ?? page.user.username;
  return (
    <div className="relative min-h-dvh pb-28">
      <MountainArt />
      <Header tab={tab} go={go} isPublished={page.isPublished} />
      <EditorWorkspace preview={<LivePreview page={page} isPublished={page.isPublished} />}>
        {children}
        <footer className="pb-4 pt-12 text-center text-xs text-[#9a9f9b] lg:text-left">{displayName} · kachko.in/{page.user.username}{page.isPrimary ? "" : `/${page.slug}`} — Powered by <span className="font-extrabold text-[#718c1b]">Kachko</span></footer>
      </EditorWorkspace>
      <Sidebar tab={tab} go={go} />
    </div>
  );
}

export function EditorWorkspace({ children, preview }: { children: ReactNode; preview: ReactNode }) {
  return (
    <div className="relative z-10 mx-auto grid w-full max-w-[1380px] gap-[52px] px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-[40px]">
      <main className="min-w-0">{children}</main>
      <aside className="order-first pb-2 lg:order-none lg:pb-0">
        <div className="lg:sticky lg:top-[102px]">{preview}</div>
      </aside>
    </div>
  );
}
