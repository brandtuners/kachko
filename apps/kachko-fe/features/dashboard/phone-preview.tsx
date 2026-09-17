"use client";

// Fixed mobile preview (reference: kachko_dashboard.html `.preview-card`).
// Shows the page exactly as visitors see it — same theme engine and same
// BlockView/SocialRow components the public /@username page uses — fed by the
// live optimistic editor state, so edits appear instantly.
// The devices pill is a REAL viewport toggle (phone ↔ desktop) of the same
// live content, and the share icon copies/passes the actual public URL.
import { useState } from "react";
import type { EditorPage } from "../editor/types";
import { BlockView, SocialRow } from "../page/block-view";
import { themeBackground, themeVars } from "../page/theme";
import { IconCheck, IconClipboard } from "../../components/icons";
import { publicPageUrl } from "../../lib/public-url";

type Device = "phone" | "desktop";

export function PhonePreview({ page, isPublished }: { page: EditorPage; isPublished: boolean }) {
  const [device, setDevice] = useState<Device>("phone");
  const [copied, setCopied] = useState(false);

  // The API expands the full theme row on /pages/me, so the preview uses the
  // exact same theme engine (CSS vars + gradient) as the public /@username page.
  const themeJson = page.theme ?? null;
  const vars = themeVars(themeJson);
  const background = themeBackground(themeJson);

  const blocks = [...page.blocks].sort((a, b) => a.position - b.position);
  const name = page.user.displayName ?? page.user.username;

  const share = async () => {
    const url = publicPageUrl(page.user.username, window.location.origin);
    try {
      if (navigator.share) {
        await navigator.share({ title: `${name} on Kachko`, url });
        return;
      }
    } catch {
      /* user dismissed the sheet — fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="k-panel rounded-[25px] p-[18px_20px_23px]">
      {/* card head: Live · devices */}
      <div className="flex items-center justify-between px-1 pb-3.5 pt-0.5">
        <span className="flex items-center gap-2 text-xs font-extrabold text-[var(--k-ink)]">
          <span className={`h-2 w-2 rounded-full ${isPublished ? "bg-[#bde738] shadow-[0_0_0_4px_#f2f8df]" : "bg-[#d8dbd4] shadow-[0_0_0_4px_#f2f2ec]"}`} />
          {isPublished ? "Live Preview" : "Draft Preview"}
        </span>
        <div className="flex rounded-[18px] border border-[#dfe2dc] p-[3px]" role="group" aria-label="Preview device">
          <button
            type="button"
            aria-pressed={device === "phone"}
            onClick={() => setDevice("phone")}
            title="Phone"
            className={`h-[26px] w-[42px] rounded-[14px] text-xs transition ${device === "phone" ? "bg-[#111312] text-white" : "text-[#747a76]"}`}
          >
            ▯
          </button>
          <button
            type="button"
            aria-pressed={device === "desktop"}
            onClick={() => setDevice("desktop")}
            title="Desktop"
            className={`h-[26px] w-[42px] rounded-[14px] text-xs transition ${device === "desktop" ? "bg-[#111312] text-white" : "text-[#747a76]"}`}
          >
            ▱
          </button>
        </div>
      </div>

      {device === "phone" ? (
        <div className="mx-auto w-[305px] max-w-full">
          {/* phone chrome — reference `.phone` */}
          <div className="relative h-[600px] overflow-hidden rounded-[44px] border-[8px] border-[#111312] shadow-[0_19px_42px_rgba(16,20,16,.16)]">
            {/* notch */}
            <span aria-hidden className="absolute left-1/2 top-[10px] z-20 h-6 w-[96px] -translate-x-1/2 rounded-[20px] bg-[#111312]" />
            {/* share */}
            <button
              type="button"
              onClick={share}
              title={copied ? "Link copied" : "Share my page"}
              className="absolute right-3 top-10 z-20 grid h-8 w-8 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30"
            >
              {copied ? <IconCheck className="h-4 w-4" /> : <IconClipboard className="h-4 w-4" />}
            </button>

            <div
              className="h-full overflow-y-auto overscroll-contain px-4 pb-8 pt-14 text-center"
              style={{ ...vars, color: "var(--page-text, white)", fontFamily: "var(--page-font, inherit)", background, scrollbarWidth: "thin" }}
            >
              <ProfileHead name={name} page={page} blocks={blocks} />
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#dfe2dc] bg-white shadow-[0_8px_24px_rgba(22,27,22,.06)]">
          {/* browser chrome */}
          <div className="flex items-center gap-2 border-b border-[#eceee9] bg-[#f7f7f2] px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#e5e7e0]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#e5e7e0]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#e5e7e0]" />
            <span className="ml-2 truncate rounded-md bg-white px-2 py-0.5 text-[10px] text-[#9a9f9b]">
              kachko.app/@{page.user.username}
            </span>
          </div>
          <div
            className="h-[520px] overflow-y-auto overscroll-contain px-6 py-8 text-center"
            style={{ ...vars, color: "var(--page-text, white)", fontFamily: "var(--page-font, inherit)", background, scrollbarWidth: "thin" }}
          >
            <div className="mx-auto max-w-[560px]">
              <ProfileHead name={name} page={page} blocks={blocks} />
            </div>
          </div>
        </div>
      )}

      <p className="mt-3 text-center text-[11px] text-[#9a9f9b]">
        {isPublished ? "Exactly what visitors get at " : "Publish to share — visitors currently get a 404 at "}
        <code className="font-bold text-[#718c1b]">/@{page.user.username}</code>
      </p>
    </div>
  );
}

function ProfileHead({
  name,
  page,
  blocks,
}: {
  name: string;
  page: EditorPage;
  blocks: EditorPage["blocks"];
}) {
  return (
    <div className="flex flex-col items-center">
      {page.user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-white/40" />
      ) : (
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white/15 text-xl font-bold text-[color:var(--page-text,white)] ring-2 ring-white/40">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <p style={{ fontSize: "var(--page-title-size, 32px)" }} className="mt-2.5 max-w-full truncate font-bold">{name}</p>
      <p className="text-[11px] text-[color:var(--page-text,white)] opacity-70">@{page.user.username}</p>
      {page.description ? (
        <p className="mt-2 line-clamp-3 text-[11.5px] leading-relaxed text-[color:var(--page-text,white)] opacity-70">{page.description}</p>
      ) : null}

      <div className="mt-5 flex w-full flex-col gap-2.5">
        {blocks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/20 px-3 py-6 text-[11px] text-[color:var(--page-text,white)] opacity-70">
            Your blocks will appear here
          </p>
        ) : (
          blocks.map((b) => <BlockView key={b.id} block={b} />)
        )}
      </div>

      <SocialRow socials={page.socials} />

      <p className="mt-8 text-[9px] font-semibold uppercase tracking-widest text-[color:var(--page-text,white)] opacity-70">Kachko</p>
    </div>
  );
}
