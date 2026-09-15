"use client";

// Shared shell for the sign-up → onboarding flow, styled to the cream + lime
// scheme (reference: kachko_dashboard.html). One decision per screen: eyebrow
// "Step N", big ink headline, content, and a fixed footer with an optional
// "Skip for now" on the left and an ink "Continue →" pill on the right.
// The `.ob-*` classes live in globals.css and already carry the light scheme;
// this file only handles layout + the logo lockup + the progress bar.
import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowLeft, IconArrowRight } from "../../components/icons";

/** Full brand lockup (arch mark + KACHKO wordmark) — /logo.png on cream. */
export function ObLogo() {
  return (
    <Link href="/" aria-label="Kachko home" className="inline-flex items-center transition hover:opacity-90">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="KACHKO" className="h-9 w-auto" />
    </Link>
  );
}

export function ObShell({
  step,
  total = 8,
  title,
  subtitle,
  children,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  nextLoading,
  onBack,
  backHref,
  onSkip,
  skipLabel = "Skip for now",
  align = "left",
}: {
  step?: number;
  total?: number;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  onBack?: () => void;
  backHref?: string;
  onSkip?: () => void;
  skipLabel?: string;
  align?: "left" | "center";
}) {
  const progress = step ? Math.min(100, Math.round((step / total) * 100)) : 0;
  const centered = align === "center";

  return (
    <main className="ob-shell relative flex flex-col overflow-hidden">
      {/* Ambient lime glow, echoing the dashboard hero radial. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-24 h-72 w-72 rounded-full bg-[rgba(220,239,168,0.45)] blur-[110px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-32 h-72 w-72 rounded-full bg-[rgba(200,242,74,0.22)] blur-[120px]"
      />

      {/* Progress bar — lime fill on a pale track. */}
      {step ? (
        <div className="fixed inset-x-0 top-0 z-20 h-1 bg-[#eceee8]">
          <div
            className="h-full bg-[var(--k-lime)] transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      <header className="dash relative z-10 flex items-center py-5">
        <ObLogo />
      </header>

      <div className={`dash relative z-10 flex w-full flex-1 flex-col pb-36 pt-4 sm:pt-8 ${centered ? "items-center text-center" : ""}`}>
        <div className={`w-full ${centered ? "max-w-xl" : "max-w-2xl"}`}>
          {step ? <p className="ob-eyebrow">Step {step}</p> : null}
          <h1 className="ob-headline">{title}</h1>
          {subtitle ? <p className="ob-sub">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20">
        <div className="dash flex items-center justify-between gap-4 pb-6 pt-10 sm:pb-8">
          <div className="flex min-w-0 items-center gap-3">
            {onBack || backHref ? (
              backHref ? (
                <Link href={backHref} aria-label="Go back" className="ob-back">
                  <IconArrowLeft className="h-5 w-5" />
                </Link>
              ) : (
                <button type="button" aria-label="Go back" className="ob-back" onClick={onBack}>
                  <IconArrowLeft className="h-5 w-5" />
                </button>
              )
            ) : null}
            {onSkip ? (
              <button type="button" className="ob-skip truncate" onClick={onSkip}>
                {skipLabel}
              </button>
            ) : (
              <span />
            )}
          </div>
          <button
            type="button"
            className="ob-btn-white shrink-0"
            disabled={nextDisabled || nextLoading}
            onClick={onNext}
          >
            {nextLoading ? "Saving…" : nextLabel}
            <IconArrowRight className="h-4 w-4" />
          </button>
        </div>
        {/* Fade so content scrolling under the footer stays readable. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-16 bg-gradient-to-b from-transparent to-[#fbfaf6]" />
      </footer>
    </main>
  );
}
