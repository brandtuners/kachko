import Link from "next/link";
import { Suspense } from "react";
import { ObLogo } from "../../../features/onboarding/ob-shell";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="ob-shell relative flex min-h-dvh flex-col">
      <header className="dash flex items-center justify-between py-5"><ObLogo /><Link href="/login" className="text-sm font-bold hover:underline">Back to login</Link></header>
      <div className="dash flex flex-1 flex-col items-center justify-center pb-20 text-center">
        <h1 className="ob-headline !mt-0">Reset your password</h1>
        <p className="ob-sub mt-3">Request a secure one-time link or choose a new password.</p>
        <div className="mt-8 w-full max-w-sm text-left"><Suspense fallback={<div className="k-panel p-6">Loading…</div>}><ResetPasswordForm /></Suspense></div>
      </div>
    </main>
  );
}
