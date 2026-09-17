"use client";

import { useState } from "react";
import { apiFetch, ApiClientError } from "../../lib/api";

const reasons = ["SPAM", "HARASSMENT", "IMPERSONATION", "ILLEGAL_CONTENT", "OTHER"] as const;

export function ReportPage({ pageId }: { pageId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof reasons)[number]>("SPAM");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setState("sending"); setError(null);
    try {
      await apiFetch("/moderation/reports", { method: "POST", body: JSON.stringify({ pageId, reason, ...(details.trim() ? { details: details.trim() } : {}) }) });
      setState("sent");
    } catch (value) {
      setState("idle");
      setError(value instanceof ApiClientError ? value.message : "Could not submit this report.");
    }
  };

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-5 text-xs text-[color:var(--page-text,white)] opacity-60 underline underline-offset-4">Report this page</button>;
  return (
    <div className="mt-5 w-full max-w-md rounded-2xl bg-black/20 p-4 text-left text-sm text-[color:var(--page-text,white)] backdrop-blur">
      {state === "sent" ? <p role="status">Thanks. Our moderation team will review this report.</p> : <>
        <label className="block text-xs font-bold" htmlFor="report-reason">Reason</label>
        <select id="report-reason" value={reason} onChange={event => setReason(event.target.value as typeof reason)} className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-black">
          {reasons.map(value => <option value={value} key={value}>{value.replaceAll("_", " ").toLowerCase()}</option>)}
        </select>
        <label className="mt-3 block text-xs font-bold" htmlFor="report-details">Details (optional)</label>
        <textarea id="report-details" value={details} minLength={10} maxLength={2000} onChange={event => setDetails(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg bg-white px-3 py-2 text-black" />
        {error ? <p className="mt-2 text-xs text-red-200" role="alert">{error}</p> : null}
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={state === "sending" || (!!details && details.trim().length < 10)} onClick={submit} className="rounded-full bg-white px-4 py-2 font-bold text-black disabled:opacity-50">{state === "sending" ? "Sending…" : "Submit report"}</button>
          <button type="button" onClick={() => setOpen(false)} className="px-3 py-2">Cancel</button>
        </div>
      </>}
    </div>
  );
}
