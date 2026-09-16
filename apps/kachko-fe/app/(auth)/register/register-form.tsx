"use client";

// Sign-up form — cream + lime scheme (reference: kachko_dashboard.html).
// Same registration contract as before (email/username/password → opaque
// session, AD-05/AD-06); only the visuals change. On success we hand off to
// the 8-step onboarding wizard.
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { schemaResolver } from "../../../lib/form-resolver";
import { registerSchema } from "@kachko/validation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiClientError } from "../../../lib/api";
import { IconArrowRight } from "../../../components/icons";

type Form = { email: string; username: string; password: string };

export default function RegisterForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: schemaResolver(registerSchema) });

  async function onSubmit(values: Form) {
    setServerError(null);
    try {
      await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(values) });
      queryClient.clear();
      router.push("/onboarding");
    } catch (e: unknown) {
      setServerError(e instanceof ApiClientError ? e.message : "Something went wrong. Try again.");
    }
  }

  const fieldError = (m?: string) =>
    m ? <p className="mt-1.5 text-xs font-medium text-[#b4322c]">{m}</p> : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="k-panel flex w-full flex-col gap-3.5 p-5">
      <div>
        <input
          className="ob-input"
          type="email"
          autoComplete="email"
          placeholder="Email address"
          aria-label="Email address"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {fieldError(errors.email?.message)}
      </div>
      <div>
        <input
          className="ob-input"
          autoCapitalize="none"
          autoComplete="username"
          placeholder="Pick a username"
          aria-label="Username"
          aria-invalid={!!errors.username}
          {...register("username")}
        />
        {errors.username?.message ? (
          fieldError(errors.username.message)
        ) : (
          <p className="mt-1.5 text-xs text-[var(--k-muted)]">3–30 chars · lowercase letters, numbers, underscore</p>
        )}
      </div>
      <div>
        <input
          className="ob-input"
          type="password"
          autoComplete="new-password"
          placeholder="Choose a password"
          aria-label="Choose a password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {fieldError(errors.password?.message)}
      </div>

      <label className="mt-1 flex cursor-pointer items-start gap-2.5 text-xs text-[var(--k-muted)]">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 appearance-none rounded-[5px] border border-[#c9cdc6] bg-white transition checked:border-[#b5d936] checked:bg-[var(--k-lime)]"
          style={{
            backgroundImage: accepted
              ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23111312' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 13l4 4L19 7'/%3E%3C/svg%3E\")"
              : undefined,
            backgroundSize: "12px",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        <span>
          I&apos;m at least 13 years old and I agree to the{" "}
          <a href="/legal/terms" className="font-bold text-[var(--k-ink)] underline-offset-2 hover:underline">
            Terms
          </a>{" "}
          and{" "}
          <a href="/legal/privacy" className="font-bold text-[var(--k-ink)] underline-offset-2 hover:underline">
            Privacy Policy
          </a>
          .
        </span>
      </label>

      {serverError ? <p className="text-sm text-[#b4322c]">{serverError}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting || !accepted}
        className="ob-btn-white mt-1 w-full"
      >
        {isSubmitting ? "Creating your Kachko…" : "Continue"}
        <IconArrowRight className="h-4 w-4" />
      </button>

      <p className="text-center text-sm text-[var(--k-muted)]">
        Already have a Kachko?{" "}
        <a href="/login" className="font-bold text-[var(--k-ink)] hover:underline">
          Log in
        </a>
      </p>
    </form>
  );
}
