"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "../../../lib/api";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null);
    if (token && password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      if (token) await apiFetch("/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ token, password }) });
      else await apiFetch("/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) });
      setDone(true);
    } catch (value) {
      setError(value instanceof ApiClientError ? value.message : "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  };

  if (done) return (
    <div className="k-panel p-6 text-center">
      <h2 className="text-xl font-extrabold">{token ? "Password changed" : "Check your email"}</h2>
      <p className="mt-2 text-sm text-[var(--k-muted)]">{token ? "All existing sessions were signed out. You can now log in with your new password." : "If that email belongs to an account, a reset link is on its way."}</p>
      <Link href="/login" className="k-btn-lime mt-5">Go to login</Link>
    </div>
  );

  return (
    <form onSubmit={submit} className="k-panel grid gap-4 p-6">
      {token ? <>
        <div><label htmlFor="new-password" className="k-label">New password</label><input id="new-password" className="ob-input" type="password" minLength={12} maxLength={128} autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} /></div>
        <div><label htmlFor="confirm-password" className="k-label">Confirm password</label><input id="confirm-password" className="ob-input" type="password" minLength={12} maxLength={128} autoComplete="new-password" required value={confirm} onChange={event => setConfirm(event.target.value)} /></div>
      </> : <div><label htmlFor="reset-email" className="k-label">Email address</label><input id="reset-email" className="ob-input" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></div>}
      {error ? <p role="alert" className="text-sm text-[#b4322c]">{error}</p> : null}
      <button type="submit" disabled={busy} className="ob-btn-white">{busy ? "Please wait…" : token ? "Set new password" : "Send reset link"}</button>
    </form>
  );
}
