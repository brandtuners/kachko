import type { ReactNode } from "react";
import type { EditorPage } from "../editor/types";
import type { PublicPage } from "./public-page";
import { BlockView, SocialBar } from "./block-view";

type RenderablePage = EditorPage | PublicPage;

export function ProfileHeader({ page, compact = false }: { page: RenderablePage; compact?: boolean }) {
  const name = page.user.displayName ?? page.user.username;
  const avatarSize = compact ? "h-16 w-16" : "h-24 w-24";
  return (
    <>
      <div className={compact ? "mb-2.5" : "mb-5"}>
        {page.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.user.avatarUrl} alt={`${name} avatar`} className={`${avatarSize} rounded-full object-cover ring-2 ring-white/40`} />
        ) : (
          <span className={`grid ${avatarSize} place-items-center rounded-full bg-white/15 text-xl font-bold text-[color:var(--page-text,white)] ring-2 ring-white/40`}>
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <h1 style={{ fontSize: "var(--page-title-size, 32px)", color: "var(--page-title-color, var(--page-text, white))" }} className={`${compact ? "max-w-full truncate" : "text-center text-2xl sm:text-3xl"} font-bold`}>{name}</h1>
      <p className={`${compact ? "text-[11px]" : "mt-1 text-sm"} text-[color:var(--page-text,white)] opacity-70`}>@{page.user.username}</p>
      {page.description ? <p className={`${compact ? "mt-2 line-clamp-3 text-[11.5px]" : "mt-4 max-w-md text-base"} text-center leading-relaxed text-[color:var(--page-text,white)] opacity-70`}>{page.description}</p> : null}
    </>
  );
}

export function BlockRenderer({ page, compact = false }: { page: RenderablePage; compact?: boolean }) {
  const blocks = [...page.blocks].sort((a, b) => a.position - b.position);
  return (
    <div className={`${compact ? "mt-5 gap-2.5" : "mt-8 max-w-md gap-3"} flex w-full flex-col`}>
      {blocks.length ? blocks.map((block) => <BlockView key={block.id} block={block} />) : (
        <p className="rounded-xl border border-dashed border-white/20 px-3 py-6 text-[11px] text-[color:var(--page-text,white)] opacity-70">Your blocks will appear here</p>
      )}
    </div>
  );
}

export function BrandFooter({ visible, compact = false }: { visible: boolean; compact?: boolean }) {
  if (!visible) return null;
  return (
    <footer className={`${compact ? "mt-8 text-[9px]" : "mt-12 text-xs"} flex items-center justify-center gap-1.5 text-[color:var(--page-text,white)] opacity-70`}>
      <svg viewBox="0 0 48 48" className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden><path d="M8 40V18c0-8.3 6.7-15 15-15s15 6.7 15 15v22h-7V18c0-4.4-3.6-8-8-8s-8 3.6-8 8v22H8Z" fill="currentColor" /></svg>
      Made with <span className="font-bold">KACHKO</span>
    </footer>
  );
}

export function PublicPageRenderer({ page, compact = false, reportAction }: { page: RenderablePage; compact?: boolean; reportAction?: ReactNode }) {
  return (
    <div className="flex w-full flex-col items-center">
      <ProfileHeader page={page} compact={compact} />
      <SocialBar socials={page.socials} />
      <BlockRenderer page={page} compact={compact} />
      <BrandFooter visible={page.theme?.config?.footer.visible ?? true} compact={compact} />
      {reportAction}
    </div>
  );
}
