"use client";

// Step 08 — completion (reference: "sign up process 08.png").
// Centered white card with a locally generated page QR + share line;
// "Continue →" lands on the dashboard. No page URL is sent to a QR service.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ensurePage } from "../../../features/editor/api";
import { ObShell } from "../../../features/onboarding/ob-shell";
import { useOnboarding } from "../../../features/onboarding/store";
import { IconCopy, IconCheck } from "../../../components/icons";
import { PageQr } from "../../../features/share/page-qr";
import { publicPageUrl } from "../../../lib/public-url";

export default function OnboardingDoneStep() {
  const router = useRouter();
  const reset = useOnboarding((s) => s.reset);
  const [copied, setCopied] = useState(false);

  const page = useQuery({ queryKey: ["my-page"], queryFn: ensurePage });
  const p = page.data;
  const url = typeof window !== "undefined" && p ? publicPageUrl(p.user.username, window.location.origin) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const finish = () => {
    reset();
    router.push("/dashboard");
  };

  return (
    <ObShell
      step={8}
      align="center"
      title="Your Kachko is live-ish 🎉"
      subtitle="Scan or share your link — then set up the rest from your dashboard."
      onNext={finish}
      nextLabel="Go to my dashboard"
      onBack={() => router.back()}
    >
      <div className="mx-auto w-full max-w-sm rounded-3xl border border-[#e9ebe6] bg-white p-7 text-[var(--k-text)] shadow-[0_24px_60px_-24px_rgba(21,27,21,0.25)]">
        {page.isLoading ? (
          <div className="grid aspect-square place-items-center text-sm text-[var(--k-muted)]">Loading…</div>
        ) : p ? (
          <>
            <div className="flex justify-center"><PageQr url={url} username={p.user.username} size={216} /></div>
            <p className="mt-4 text-center text-sm font-extrabold text-[var(--k-ink)]">{p.user.displayName ?? `@${p.user.username}`}</p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#e6e8e1] bg-[#f8f9f4] px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-xs text-[var(--k-muted)]">{url}</code>
              <button
                type="button"
                onClick={copy}
                aria-label="Copy link"
                className="shrink-0 rounded-lg bg-[var(--k-ink)] p-1.5 text-white transition hover:bg-[#252927] active:scale-95"
              >
                {copied ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-[var(--k-muted)]">
              Point a phone camera at the QR code to open your page.
            </p>
          </>
        ) : (
          <p className="text-center text-sm text-[var(--k-muted)]">Something went wrong — continue to your dashboard and try again.</p>
        )}
      </div>
    </ObShell>
  );
}
