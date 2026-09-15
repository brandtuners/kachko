// Sign-up entry screen — cream + lime scheme (kachko_dashboard.html).
// Logo lockup up top, ink headline with a lime accent, real form on a white
// panel. The reference's Google button is intentionally omitted — Kachko V1
// ships email/password auth only (AD-05), and a dead OAuth button would mislead
// users.
import Link from "next/link";
import RegisterForm from "./register-form";
import { ObLogo } from "../../../features/onboarding/ob-shell";

export default function RegisterPage() {
  return (
    <main className="ob-shell relative flex flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-16 h-80 w-80 rounded-full bg-[rgba(220,239,168,0.45)] blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 top-40 h-80 w-80 rounded-full bg-[rgba(200,242,74,0.2)] blur-[130px]"
      />

      <header className="dash relative z-10 flex items-center justify-between py-5">
        <ObLogo />
        <span className="text-sm text-[var(--k-muted)]">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-[var(--k-ink)] underline-offset-4 hover:underline">
            Log in
          </Link>
        </span>
      </header>

      <div className="dash relative z-10 flex flex-1 flex-col items-center justify-center pb-16 pt-6 text-center">
        <h1 className="ob-headline max-w-xl !mt-0 sm:!text-[52px]">
          Everything you are,
          <br />
          in one <span className="k-accent">free</span> link.
        </h1>
        <p className="ob-sub mt-4 max-w-md !text-base">
          Claim your Kachko, add your links, and share one page that actually looks like you.
        </p>
        <div className="mt-10 w-full max-w-sm text-left">
          <RegisterForm />
        </div>
      </div>

      <footer className="dash relative z-10 flex items-center justify-center gap-6 pb-8 pt-4 text-xs text-[var(--k-muted)]">
        <Link href="/legal/terms" className="transition hover:text-[var(--k-ink)]">
          Terms
        </Link>
        <span aria-hidden>·</span>
        <Link href="/legal/privacy" className="transition hover:text-[var(--k-ink)]">
          Privacy
        </Link>
      </footer>
    </main>
  );
}
