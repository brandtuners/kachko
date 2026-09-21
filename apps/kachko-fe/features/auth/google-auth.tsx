"use client";

import { useQueryClient } from "@tanstack/react-query";
import { googleRegistrationSchema, loginSchema, type GoogleRegistrationInput, type LoginInput } from "@kachko/validation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { IconArrowRight } from "../../components/icons";
import { apiFetch, ApiClientError } from "../../lib/api";
import { schemaResolver } from "../../lib/form-resolver";

export function GoogleButton({ label }: { label: string }) {
  return (
    // This endpoint starts an OAuth redirect and must perform a document navigation.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a href="/api/v1/auth/google" className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#dfe2dc] bg-white px-4 text-sm font-extrabold text-[var(--k-ink)] transition hover:border-[#c9cdc6] hover:bg-[#fafbf7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ec31d]">
      <GoogleMark />
      {label}
    </a>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-[#e7e9e3]" />
      <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9a9f9b]">or</span>
      <span className="h-px flex-1 bg-[#e7e9e3]" />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.24-.2-1.8H12v3.4h5.52a4.72 4.72 0 0 1-2.05 3.1l-.02.11 2.98 2.31.2.02c1.84-1.7 2.97-4.2 2.97-7.14Z" />
      <path fill="#34A853" d="M12 22c2.68 0 4.93-.88 6.57-2.4l-3.13-2.43c-.84.57-1.96.96-3.44.96a5.97 5.97 0 0 1-5.64-4.13l-.1.01-3.1 2.4-.04.1A9.92 9.92 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.36 14A6.14 6.14 0 0 1 6.03 12c0-.7.12-1.38.32-2l-.01-.13-3.13-2.43-.1.05A10 10 0 0 0 2 12c0 1.62.39 3.15 1.1 4.5L6.36 14Z" />
      <path fill="#EA4335" d="M12 5.87c1.87 0 3.13.8 3.85 1.48l2.79-2.73A9.4 9.4 0 0 0 12 2a9.92 9.92 0 0 0-8.88 5.49L6.35 10A5.99 5.99 0 0 1 12 5.87Z" />
    </svg>
  );
}

type CallbackStatus = "authenticated" | "onboarding" | "link-required" | "invalid";

export function GoogleCallback({ status }: { status: CallbackStatus }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GoogleRegistrationInput>({ resolver: schemaResolver(googleRegistrationSchema) });

  useEffect(() => {
    let active = true;
    async function verify() {
      try {
        if (status === "authenticated") {
          await apiFetch("/auth/me");
          queryClient.clear();
          router.replace("/dashboard");
          return;
        }
        if (status === "onboarding") {
          const pending = await apiFetch<{ email: string }>("/auth/google/pending");
          if (active) setEmail(pending.email);
          return;
        }
        if (status === "link-required") return;
        throw new Error("Google did not return a valid sign-in status.");
      } catch (error: unknown) {
        if (active) setLoadError(error instanceof ApiClientError ? error.message : "Google sign-in could not be verified. Please start again.");
      }
    }
    void verify();
    return () => { active = false; };
  }, [queryClient, router, status]);

  async function complete(values: GoogleRegistrationInput) {
    setServerError(null);
    try {
      await apiFetch("/auth/google/complete", { method: "POST", body: JSON.stringify(values) });
      queryClient.clear();
      router.replace("/onboarding");
    } catch (error: unknown) {
      setServerError(error instanceof ApiClientError ? error.message : "We couldn't finish signup. Please try again.");
    }
  }

  if (loadError) {
    return (
      <div className="k-panel flex w-full flex-col items-center gap-4 p-6 text-center" role="alert">
        <p className="text-sm font-semibold text-[#b4322c]">{loadError}</p>
        {/* OAuth initiation intentionally uses a full document navigation. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/v1/auth/google" className="ob-btn-dark w-full">Try Google again</a>
        <Link href="/login" className="text-sm font-bold text-[var(--k-ink)] hover:underline">Return to login</Link>
      </div>
    );
  }

  if (status === "link-required") return <GoogleLinkExistingAccount />;

  if (status !== "onboarding" || !email) {
    return (
      <div className="k-panel flex w-full flex-col items-center gap-3 p-8 text-center" role="status">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#e3e6de] border-t-[#111312]" />
        <p className="text-sm text-[var(--k-muted)]">Verifying your Google account…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(complete)} className="k-panel flex w-full flex-col gap-3.5 p-5">
      <div className="rounded-xl bg-[#f4f6ef] px-4 py-3">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#9a9f9b]">Google account</p>
        <p className="mt-0.5 truncate text-sm font-bold text-[var(--k-ink)]">{email}</p>
      </div>
      <div>
        <input className="ob-input" autoCapitalize="none" autoComplete="username" placeholder="Pick a username"
          aria-label="Username" aria-invalid={!!errors.username} {...register("username")} />
        {errors.username?.message ? <p className="mt-1.5 text-xs font-medium text-[#b4322c]">{errors.username.message}</p>
          : <p className="mt-1.5 text-xs text-[var(--k-muted)]">3–30 chars · lowercase letters, numbers, underscore</p>}
      </div>
      <div>
        <input className="ob-input" autoComplete="name" placeholder="Display name (optional)"
          aria-label="Display name" aria-invalid={!!errors.displayName}
          {...register("displayName", { setValueAs: (value: string) => value.trim() || undefined })} />
        {errors.displayName?.message ? <p className="mt-1.5 text-xs font-medium text-[#b4322c]">{errors.displayName.message}</p> : null}
      </div>
      {serverError ? <p className="text-sm text-[#b4322c]" role="alert">{serverError}</p> : null}
      <button type="submit" disabled={isSubmitting} className="ob-btn-white mt-1 w-full">
        {isSubmitting ? "Creating your Kachko…" : "Finish signup"}
        <IconArrowRight className="h-4 w-4" />
      </button>
      <p className="text-center text-xs text-[var(--k-muted)]">
        By continuing, you confirm you are at least 13 and agree to the <Link href="/legal/terms" className="font-bold hover:underline">Terms</Link> and <Link href="/legal/privacy" className="font-bold hover:underline">Privacy Policy</Link>.
      </p>
    </form>
  );
}

function GoogleLinkExistingAccount() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: schemaResolver(loginSchema) });

  async function link(values: LoginInput) {
    setServerError(null);
    try {
      await apiFetch("/auth/login", { method: "POST", body: JSON.stringify(values) });
      await apiFetch("/auth/google/link/complete", { method: "POST", body: "{}" });
      queryClient.clear();
      router.replace("/dashboard");
    } catch (error: unknown) {
      setServerError(error instanceof ApiClientError ? error.message : "We couldn't link this Google account. Please start again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(link)} className="k-panel flex w-full flex-col gap-3.5 p-5">
      <div className="rounded-xl bg-[#f4f6ef] px-4 py-3 text-sm text-[var(--k-muted)]">
        This email already has a KACHKO account. Sign in once to securely attach Google to it.
      </div>
      <div><input className="ob-input" type="email" autoComplete="email" placeholder="Existing account email" aria-label="Email address" aria-invalid={!!errors.email} {...register("email")} />{errors.email?.message ? <p className="mt-1.5 text-xs text-[#b4322c]">{errors.email.message}</p> : null}</div>
      <div><input className="ob-input" type="password" autoComplete="current-password" placeholder="Password" aria-label="Password" aria-invalid={!!errors.password} {...register("password")} />{errors.password?.message ? <p className="mt-1.5 text-xs text-[#b4322c]">{errors.password.message}</p> : null}</div>
      {serverError ? <p role="alert" className="text-sm text-[#b4322c]">{serverError}</p> : null}
      <button type="submit" disabled={isSubmitting} className="ob-btn-white">{isSubmitting ? "Linking…" : "Sign in and link Google"}<IconArrowRight className="h-4 w-4" /></button>
      {/* OAuth initiation intentionally uses a full document navigation. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/api/v1/auth/google" className="text-center text-sm font-bold hover:underline">Use a different Google account</a>
    </form>
  );
}
