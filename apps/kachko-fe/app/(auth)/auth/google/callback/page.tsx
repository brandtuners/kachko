import { GoogleCallback } from "../../../../../features/auth/google-auth";
import { ObLogo } from "../../../../../features/onboarding/ob-shell";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function GoogleCallbackPage({ searchParams }: { searchParams: SearchParams }) {
  const value = (await searchParams).status;
  const status = value === "authenticated" || value === "onboarding" || value === "link-required" ? value : "invalid";
  return (
    <main className="ob-shell relative flex flex-col overflow-hidden">
      <header className="dash relative z-10 flex items-center py-5"><ObLogo /></header>
      <div className="dash relative z-10 flex flex-1 flex-col items-center justify-center pb-16 pt-6 text-center">
        <h1 className="ob-headline !mt-0 sm:!text-[52px]">
          {status === "onboarding" ? <>Choose your <span className="k-accent">name</span></> : status === "link-required" ? <>Link your <span className="k-accent">account</span></> : <>Signing you <span className="k-accent">in</span></>}
        </h1>
        <p className="ob-sub mt-4 max-w-md !text-base">
          {status === "onboarding" ? "One last step before your Kachko is ready." : status === "link-required" ? "Confirm the existing account that owns this email." : "We’re securely verifying your Google account."}
        </p>
        <div className="mt-10 w-full max-w-sm text-left"><GoogleCallback status={status} /></div>
      </div>
    </main>
  );
}
