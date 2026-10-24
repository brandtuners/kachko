import { SignIn, SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { ObLogo } from "../onboarding/ob-shell";

const authAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full rounded-[28px] border border-[#e6e8e2] bg-white p-6 shadow-[0_18px_55px_rgba(21,27,21,.10)] sm:p-8",
    headerTitle: "text-[#111312] font-extrabold",
    headerSubtitle: "text-[#777c79]",
    formButtonPrimary: "bg-[#111312] hover:bg-[#292d2a] text-white rounded-full font-extrabold",
    formFieldInput: "rounded-xl border-[#dfe2dc] focus:border-[#a4cf29] focus:ring-[#a4cf29]",
    socialButtonsBlockButton: "rounded-full border-[#dfe2dc] hover:bg-[#f6f7f2]",
    footerActionLink: "font-extrabold text-[#111312] hover:text-[#718c1b]",
  },
} as const;

export function ClerkAuthScreen({ mode }: { mode: "sign-in" | "sign-up" }) {
  const signingIn = mode === "sign-in";
  return (
    <main className="ob-shell relative flex flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-16 h-80 w-80 rounded-full bg-[rgba(220,239,168,0.45)] blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute -right-28 bottom-24 h-80 w-80 rounded-full bg-[rgba(200,242,74,0.2)] blur-[130px]" />
      <header className="dash relative z-10 flex items-center justify-between py-5">
        <ObLogo />
        <span className="text-sm text-[var(--k-muted)]">
          {signingIn ? "New here? " : "Already have an account? "}
          <Link href={signingIn ? "/register" : "/login"} className="font-bold text-[var(--k-ink)] underline-offset-4 hover:underline">
            {signingIn ? "Create a Kachko" : "Log in"}
          </Link>
        </span>
      </header>
      <div className="dash relative z-10 flex flex-1 flex-col items-center justify-center pb-16 pt-6 text-center">
        <h1 className="ob-headline !mt-0 max-w-xl sm:!text-[52px]">
          {signingIn ? <>Welcome <span className="k-accent">back</span></> : <>Everything you are,<br />in one <span className="k-accent">free</span> link.</>}
        </h1>
        <p className="ob-sub mt-4 max-w-md !text-base">
          {signingIn ? "Log in to keep building the one link that is all you." : "Claim your Kachko, add your links, and share pages that actually look like you."}
        </p>
        <div className="mt-10 w-full max-w-md text-left">
          <Suspense fallback={<div className="h-[420px] animate-pulse rounded-[28px] bg-white" />}>
            {signingIn ? (
              <SignIn routing="path" path="/login" signUpUrl="/register" fallbackRedirectUrl="/dashboard" appearance={authAppearance} />
            ) : (
              <SignUp routing="path" path="/register" signInUrl="/login" fallbackRedirectUrl="/onboarding" appearance={authAppearance} />
            )}
          </Suspense>
        </div>
      </div>
    </main>
  );
}
