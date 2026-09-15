"use client";

// Dashboard chrome (reference: kachko_dashboard.html).
// Top bar: arch brand-mark + "Kachko" wordmark, right cluster = My QR button,
// live-page button, and the account pill with a dropdown (name · @handle ·
// quick links · Log out — the logout that was missing app-wide).
// Bottom dock: icon-over-label pills — Home · Links · Design · Analytics ·
// Settings — active gets the lime chip + dot, exactly like the reference.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { useEditor } from "../editor/use-editor";
import {
  IconArrowUpRight,
  IconChart,
  IconChevronDown,
  IconEye,
  IconLink,
  IconPalette,
  IconQr,
  IconSettings,
} from "../../components/icons";

export type DashTab = "home" | "blocks" | "qr" | "appearance" | "analytics" | "links";

function KachkoMark() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3" aria-label="Kachko dashboard">
      <svg viewBox="0 0 48 48" className="h-[38px] w-[38px]" aria-hidden>
        <path d="M8 40V18c0-8.3 6.7-15 15-15s15 6.7 15 15v22h-7V18c0-4.4-3.6-8-8-8s-8 3.6-8 8v22H8Z" fill="#111312" />
        <path d="M29 40V18c0-4.4 3.6-8 8-8v30h-8Z" fill="#c8f24a" />
      </svg>
      <span className="text-[24px] font-extrabold tracking-[-1.2px] text-[var(--k-ink)]">Kachko</span>
    </Link>
  );
}

export function TopNav({ tab, go, isPublished }: { tab: DashTab; go: (t: DashTab) => void; isPublished: boolean }) {
  const editor = useEditor();
  const user = editor.page?.user;
  const name = user?.displayName ?? user?.username ?? "Kachko";
  return (
    <header className="k-topbar">
      <div className="mx-auto flex w-full max-w-[1380px] items-center justify-between gap-3 px-5 sm:px-8 lg:px-[58px]">
        <KachkoMark />

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label="My QR"
            title="My QR"
            onClick={() => go("qr")}
            className={`k-icon-btn ${tab === "qr" ? "!border-[#b5d936] !bg-[#f1f9d9] !text-[#141714]" : ""}`}
          >
            <IconQr className="h-[18px] w-[18px]" />
          </button>

          {/* View my page — kept from the old dock (draft-aware: unpublished
              pages 404, so it points at the Home publish banner instead). */}
          {isPublished ? (
            <Link
              href={user ? `/@${user.username}` : "/"}
              target="_blank"
              rel="noreferrer"
              className="k-btn-ink !h-10 !px-4"
            >
              View my page
              <IconArrowUpRight className="h-4 w-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => go("home")}
              title="Publish your page first — visitors currently get a 404"
              className="k-btn-ink !h-10 !px-4 !opacity-90"
            >
              View my page
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                Draft
              </span>
            </button>
          )}

          <AccountMenu name={name} handle={user?.username ?? ""} go={go} active={tab === "links"} />
        </div>
      </div>
    </header>
  );
}

/** Reference `.account`: avatar + name + role + chevron. The chevron opens a
 *  small menu — the first logout in the product, plus shortcuts to Settings
 *  and My QR. */
function AccountMenu({ name, handle, go, active }: { name: string; handle: string; go: (t: DashTab) => void; active: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const logout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST", body: "{}" });
    } catch {
      /* session cookie cleared server-side even on a hiccup; send them out anyway */
    }
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Account"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-3 rounded-full p-1 pr-2.5 transition hover:bg-[#f2f2ec] ${active ? "bg-[#f2f2ec]" : ""}`}
      >
        <Avatar />
        <span className="hidden leading-tight sm:block">
          <span className="block text-[14px] font-extrabold text-[var(--k-ink)]">{name}</span>
          <span className="mt-0.5 block text-[11px] text-[#8b908c]">@{handle}</span>
        </span>
        <IconChevronDown className="hidden h-4 w-4 text-[#8b908c] sm:block" />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-56 overflow-hidden rounded-2xl border border-[#e9ebe6] bg-white py-1.5 shadow-[0_18px_55px_rgba(21,27,21,.14)]">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              go("links");
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-[var(--k-ink)] transition hover:bg-[#f6f7f2]"
          >
            <IconSettings className="h-4 w-4 text-[#8b908c]" />
            Links &amp; profile
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              go("qr");
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-[var(--k-ink)] transition hover:bg-[#f6f7f2]"
          >
            <IconQr className="h-4 w-4 text-[#8b908c]" />
            My QR
          </button>
          <div aria-hidden className="my-1.5 h-px bg-[#eceee9]" />
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-[#b4322c] transition hover:bg-[#fdf3f2]"
          >
            <IconArrowUpRight className="h-4 w-4 rotate-90" />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Avatar({ size = 8 }: { size?: number }) {
  const editor = useEditor();
  const user = editor.page?.user;
  // size is in Tailwind spacing units (0.25rem each), like h-7 / w-12.
  const dim = { width: `${size * 0.25}rem`, height: `${size * 0.25}rem`, maxWidth: "100%" };
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#dfe1dc] text-sm font-extrabold text-[#262927] shadow-[0_0_0_4px_#f7f6f1]"
      style={dim}
    >
      {user?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        (user?.displayName ?? user?.username ?? "K").slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

// Floating dock, reference `.bottom-dock`: icon-over-label pills, active =
// lime chip with a dot below. Home · Links (page editor) · Design (themes) ·
// Analytics · Settings (profile). QR + View page live in the top bar.
export function BottomDock({ tab, go }: { tab: DashTab; go: (t: DashTab) => void }) {
  const items: { key: DashTab; label: string; icon: (p: { className?: string }) => JSX.Element }[] = [
    { key: "home", label: "Home", icon: IconEye },
    { key: "blocks", label: "Links", icon: IconLink },
    { key: "appearance", label: "Design", icon: IconPalette },
    { key: "analytics", label: "Analytics", icon: IconChart },
    { key: "links", label: "Settings", icon: IconSettings },
  ];
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-3">
      <nav
        aria-label="Dashboard sections"
        className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-[36px] border border-[#e5e8e1] bg-white/[.92] p-2 shadow-[0_20px_45px_rgba(18,24,18,.13),0_3px_9px_rgba(18,24,18,.05)] backdrop-blur-[18px]"
      >
        {items.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => go(key)}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-[52px] min-w-[76px] shrink-0 flex-col items-center justify-center gap-1 rounded-[27px] px-3 text-[10px] font-bold transition ${
                active ? "bg-[#eff8d4] text-[#141714]" : "text-[#646a66] hover:bg-[#f6f7f2]"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
              {active ? <span aria-hidden className="absolute -bottom-[3px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#b5d936]" /> : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
