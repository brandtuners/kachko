"use client";

// Login form — cream + lime scheme (matches the sign-up screen). Same login
// contract: email/password → opaque session (AD-05). Redirects to /dashboard
// on success.
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { schemaResolver } from "../../../lib/form-resolver";
import { loginSchema } from "@kachko/validation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { apiFetch, ApiClientError } from "../../../lib/api";
import { IconArrowRight } from "../../../components/icons";
import { AuthDivider, GoogleButton } from "../../../features/auth/google-auth";

type Form = { email: string; password: string };

export default function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: schemaResolver(loginSchema) });

  async function onSubmit(values: Form) {
    setServerError(null);
    try {
      await apiFetch("/auth/login", { method: "POST", body: JSON.stringify(values) });
      queryClient.clear();
      router.push("/dashboard");
    } catch (e: unknown) {
      setServerError(e instanceof ApiClientError ? e.message : "Something went wrong. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="k-panel flex w-full flex-col gap-3.5 p-5">
      <GoogleButton label="Continue with Google" />
      <AuthDivider />
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
        {errors.email?.message ? (
          <p className="mt-1.5 text-xs font-medium text-[#b4322c]">{errors.email.message}</p>
        ) : null}
      </div>
      <div>
        <input
          className="ob-input"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          aria-label="Password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password?.message ? (
          <p className="mt-1.5 text-xs font-medium text-[#b4322c]">{errors.password.message}</p>
        ) : null}
      </div>

      {serverError ? <p className="text-sm text-[#b4322c]">{serverError}</p> : null}

      <button type="submit" disabled={isSubmitting} className="ob-btn-white mt-1 w-full">
        {isSubmitting ? "Logging in…" : "Log in"}
        <IconArrowRight className="h-4 w-4" />
      </button>

      <p className="text-center text-sm text-[var(--k-muted)]">
        Forgot password?{" "}
        <Link href="/forgot-password" className="font-bold text-[var(--k-ink)] hover:underline">
          Reset it
        </Link>
      </p>
    </form>
  );
}
