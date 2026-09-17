import Link from "next/link";
import { ObLogo } from "../../../features/onboarding/ob-shell";

export default function PublicPageNotFound() {
  return (
    <main className="ob-shell grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <div className="flex justify-center"><ObLogo /></div>
        <p className="k-eyebrow mt-10">404</p>
        <h1 className="text-4xl font-extrabold tracking-[-1px] text-[var(--k-ink)]">This Kachko isn&apos;t live.</h1>
        <p className="mt-4 text-[var(--k-muted)]">The page may be unpublished, unavailable, or using a different address.</p>
        <Link href="/" className="k-btn-lime mt-7">Go to KACHKO</Link>
      </div>
    </main>
  );
}
