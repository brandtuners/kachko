"use client";

import { useEffect, useState } from "react";
import type { CreatorForm, SubmissionResponse } from "@kachko/types";
import { apiFetch } from "../../lib/api";
import { sendAnalyticsEvent } from "../analytics/client";

export function PublicForm({ form, blockId, pageId, preview = false }: { form: CreatorForm; blockId: string; pageId: string; preview?: boolean }) {
  const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null);
  useEffect(() => { if (!preview) sendAnalyticsEvent({ pageId, blockId, eventType: "FORM_VIEW" }); }, [blockId, pageId, preview]);
  if (success) return <div role="status" className="w-full rounded-2xl border border-[color:var(--blk-card-border)] bg-[color:var(--blk-card-bg)] p-5 text-center"><p className="font-bold text-[color:var(--page-text,white)]">{success}</p></div>;
  return <form className="w-full rounded-2xl border border-[color:var(--blk-card-border)] bg-[color:var(--blk-card-bg)] p-5" onSubmit={async event => {
    event.preventDefault(); if (preview) return; setPending(true); setError(null);
    const data = new FormData(event.currentTarget); const values: Record<string, string | boolean> = {};
    for (const field of form.fields) values[field.name] = field.type === "CHECKBOX" ? data.get(field.name) === "on" : String(data.get(field.name) ?? "");
    try { const result = await apiFetch<SubmissionResponse["data"]>(`/public/forms/${form.id}/submissions`, { method: "POST", body: JSON.stringify({ values, marketingOptIn: values.marketing_consent === true, honeypot: String(data.get("website") ?? ""), attribution: attribution() }) });
      if (result.redirectUrl) window.location.assign(result.redirectUrl); else setSuccess(result.message ?? "Thanks — your response was received.");
    } catch (value) { setError(value instanceof Error ? value.message : "Could not submit. Please try again."); } finally { setPending(false); }
  }}>
    {form.title ? <h2 className="text-lg font-extrabold text-[color:var(--page-title-color,var(--page-text,white))]">{form.title}</h2> : null}{form.description ? <p className="mt-1 text-sm text-[color:var(--page-text,white)] opacity-75">{form.description}</p> : null}
    <div className="mt-4 grid gap-3">{form.fields.map(field => <label key={field.id} className="grid gap-1 text-xs font-bold text-[color:var(--page-text,white)]">{field.type === "CHECKBOX" ? <span className="flex items-start gap-2"><input name={field.name} type="checkbox" required={field.required} className="mt-0.5" />{field.label}</span> : <>{field.label}{field.type === "TEXTAREA" ? <textarea name={field.name} required={field.required} placeholder={field.placeholder ?? ""} maxLength={5000} className="min-h-24 rounded-xl border border-white/20 bg-white/90 px-3 py-2 text-sm text-[#111312]" /> : field.type === "SELECT" ? <select name={field.name} required={field.required} className="rounded-xl border border-white/20 bg-white/90 px-3 py-2 text-sm text-[#111312]"><option value="">Choose…</option>{field.config?.options?.map(option => <option key={option}>{option}</option>)}</select> : <input name={field.name} required={field.required} type={field.type === "EMAIL" ? "email" : field.type === "PHONE" ? "tel" : "text"} placeholder={field.placeholder ?? ""} maxLength={field.type === "EMAIL" ? 254 : 500} className="rounded-xl border border-white/20 bg-white/90 px-3 py-2 text-sm text-[#111312]" />}</>}</label>)}<label className="absolute -left-[9999px]" aria-hidden>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-200">{error}</p> : null}<button type="submit" disabled={pending || preview || !form.isActive} className="mt-4 w-full rounded-xl bg-[color:var(--blk-accent)] px-4 py-3 text-sm font-extrabold text-[#111312] disabled:opacity-50">{pending ? "Sending…" : form.submitLabel}</button>
  </form>;
}

function attribution() { if (typeof window === "undefined") return undefined; const query = new URLSearchParams(window.location.search); const result = { utmSource: query.get("utm_source") || undefined, utmMedium: query.get("utm_medium") || undefined, utmCampaign: query.get("utm_campaign") || undefined }; return Object.values(result).some(Boolean) ? result : undefined; }
