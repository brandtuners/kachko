// Login route — cream + lime scheme (matches the sign-up screen). Real login
// form → opaque session (AD-05). Redirects to /dashboard on success.
import Link from "next/link";
import LoginForm from "./login-form";
import { ObLogo } from "../../../features/onboarding/ob-shell";

export default function LoginPage() {
  return (
    <main className="ob-shell relative flex flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-16 h-80 w-80 rounded-full bg-[rgba(220,239,168,0.45)] blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 bottom-24 h-80 w-80 rounded-full bg-[rgba(200,242,74,0.2)] blur-[130px]"
      />

      <header className="dash relative z-10 flex items-center justify-between py-5">
        <ObLogo />
        <span className="text-sm text-[var(--k-muted)]">
          New here?{" "}
          <Link href="/register" className="font-bold text-[var(--k-ink)] underline-offset-4 hover:underline">
            Create a Kachko
          </Link>
        </span>
      </header>

      <div className="dash relative z-10 flex flex-1 flex-col items-center justify-center pb-16 pt-6 text-center">
        <h1 className="ob-headline !mt-0 sm:!text-[52px]">
          Welcome <span className="k-accent">back</span>
        </h1>
        <p className="ob-sub mt-4 max-w-md !text-base">
          Log in to keep building the one link that is all you.
        </p>
        <div className="mt-10 w-full max-w-sm text-left">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
