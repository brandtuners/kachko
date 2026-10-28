"use client";

/* eslint-disable @next/next/no-img-element -- editor previews owner-managed local or R2 media */

import { useState } from "react";
import Link from "next/link";
import { SOCIAL_PLATFORMS, type BlockType } from "./types";
import { useMediaUpload } from "./use-media-upload";
import { KACHKO_FEATURES, useBilling } from "../billing/use-billing";

// Per-type content form. Light, compact — used inside the dashboard's block
// editor rows (the dark panels were replaced by the reference dashboard).
// Returns a content object via onChange.
export function BlockContentForm({
  type,
  initial,
  onChange,
}: {
  type: BlockType;
  initial: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
}) {
  const [content, setContent] = useState<Record<string, unknown>>(initial ?? {});
  const media = useMediaUpload();
  const billing = useBilling();
  const set = (key: string, value: unknown) => {
    const next = { ...content, [key]: value };
    if (type === "IMAGE") delete next.url;
    setContent(next);
    onChange(next);
  };
  const applyUploadedImage = (asset: { id: string; url: string }, fallbackAlt: string) => {
    const next = { ...content, mediaId: asset.id, url: asset.url, alt: String(content.alt || fallbackAlt) };
    setContent(next);
    const { url: _url, ...payload } = next;
    void _url;
    onChange(payload);
  };
  const replace = (next: Record<string, unknown>) => { setContent(next); onChange(next); };

  const field = (key: string, label: string, placeholder = "", kind: string = "text") => (
    <div>
      <label className="dash-label">{label}</label>
      <input
        className="dash-input"
        placeholder={placeholder}
        defaultValue={String(content[key] ?? "")}
        type={kind}
        onChange={(e) => set(key, kind === "number" ? Number(e.target.value) : e.target.value)}
      />
    </div>
  );

  switch (type) {
    case "LINK": {
      const routing = (content.smartRouting as { rules?: Array<{ condition: string; value: string; destinationUrl: string }> } | undefined)?.rules ?? [];
      const automation = (content.automation as { activeFrom?: string; activeUntil?: string; redirectPage?: boolean } | undefined) ?? {};
      const dateValue = (value?: string) => {
        if (!value) return "";
        const date = new Date(value);
        return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
      };
      return (
        <div className="grid gap-3">
          {field("title", "Title", "My favorite link")}
          {field("url", "URL", "https://…")}
          <div className="rounded-xl border border-[#dfe2dc] bg-[#f7f8f3] p-3">
            <div className="mb-2 flex items-center justify-between gap-2"><p className="text-sm font-extrabold">Smart routing</p>
              {!billing.has(KACHKO_FEATURES.SMART_ROUTING) ? <Link href="/dashboard/billing" className="text-xs font-extrabold text-[#718c1b] underline">Upgrade</Link> : null}</div>
            <p className="mb-3 text-xs text-[#747a76]">Send visitors to different URLs by device, country, or referring site. First matching rule wins.</p>
            {billing.has(KACHKO_FEATURES.SMART_ROUTING) ? <div className="grid gap-2">
              {routing.map((rule, index) => <div key={index} className="grid gap-2 rounded-lg bg-white p-2 sm:grid-cols-[120px_1fr_1fr_auto]">
                <select className="dash-input" value={rule.condition} onChange={event => { const rules = routing.map((item, i) => i === index ? { ...item, condition: event.target.value } : item); replace({ ...content, smartRouting: { rules } }); }}>
                  <option value="device">Device</option><option value="country">Country</option><option value="referrer">Referrer</option>
                </select>
                <input className="dash-input" value={rule.value} placeholder={rule.condition === "country" ? "IN" : rule.condition === "device" ? "mobile" : "instagram.com"} onChange={event => { const rules = routing.map((item, i) => i === index ? { ...item, value: event.target.value } : item); replace({ ...content, smartRouting: { rules } }); }} />
                <input className="dash-input" value={rule.destinationUrl} placeholder="https://…" onChange={event => { const rules = routing.map((item, i) => i === index ? { ...item, destinationUrl: event.target.value } : item); replace({ ...content, smartRouting: { rules } }); }} />
                <button type="button" aria-label="Remove routing rule" className="px-2 font-bold text-red-600" onClick={() => { const rules = routing.filter((_, i) => i !== index); const next = { ...content }; if (rules.length) next.smartRouting = { rules }; else delete next.smartRouting; replace(next); }}>×</button>
              </div>)}
              {routing.length < 10 ? <button type="button" className="k-btn-line !h-9 !rounded-full text-xs" onClick={() => replace({ ...content, smartRouting: { rules: [...routing, { condition: "device", value: "mobile", destinationUrl: String(content.url ?? "") }] } })}>+ Add routing rule</button> : null}
            </div> : null}
          </div>
          <div className="rounded-xl border border-[#dfe2dc] bg-[#f7f8f3] p-3">
            <div className="mb-2 flex items-center justify-between gap-2"><p className="text-sm font-extrabold">Automations</p>
              {!billing.has(KACHKO_FEATURES.AUTOMATIONS) ? <Link href="/dashboard/billing" className="text-xs font-extrabold text-[#718c1b] underline">Upgrade</Link> : null}</div>
            <p className="mb-3 text-xs text-[#747a76]">Schedule availability or temporarily redirect the whole page to this link.</p>
            {billing.has(KACHKO_FEATURES.AUTOMATIONS) ? <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="dash-label">Active from</label><input className="dash-input" type="datetime-local" value={dateValue(automation.activeFrom)} onChange={event => { const value = event.target.value; replace({ ...content, automation: { ...automation, activeFrom: value ? new Date(value).toISOString() : undefined } }); }} /></div>
              <div><label className="dash-label">Active until</label><input className="dash-input" type="datetime-local" value={dateValue(automation.activeUntil)} onChange={event => { const value = event.target.value; replace({ ...content, automation: { ...automation, activeUntil: value ? new Date(value).toISOString() : undefined } }); }} /></div>
              <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input type="checkbox" checked={Boolean(automation.redirectPage)} onChange={event => replace({ ...content, automation: { ...automation, redirectPage: event.target.checked } })} /> Redirect every page visit to this link while active</label>
              <button type="button" className="text-left text-xs font-bold text-red-600" onClick={() => { const next = { ...content }; delete next.automation; replace(next); }}>Clear automation</button>
            </div> : null}
          </div>
        </div>
      );
    }
    case "TEXT":
      return (
        <div className="grid gap-3">
          <div>
            <label className="dash-label">Text</label>
            <textarea
              className="dash-input min-h-24 resize-y"
              placeholder="Say something…"
              defaultValue={String(content.text ?? "")}
              onChange={(e) => set("text", e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => set("alignment", a)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold capitalize transition ${
                  (content.alignment ?? "left") === a
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      );
    case "IMAGE":
      return (
        <div className="grid gap-3">
          {content.url ? <img src={String(content.url)} alt="" className="max-h-44 rounded-xl object-cover" /> : null}
          <label className="dash-label cursor-pointer">
            {media.isUploading ? "Uploading replacement…" : "Replace image"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={media.isUploading}
              onChange={async event => {
                const file = event.target.files?.[0]; event.target.value = "";
                if (!file) return;
                const asset = await media.uploadImage(file);
                if (!asset) return;
                applyUploadedImage(asset, file.name);
              }} />
          </label>
          {media.progress !== null && !media.error ? <div role="status" aria-label={`Image upload ${media.progress}%`}><div className="mb-1 flex justify-between text-xs font-semibold text-[#718c1b]"><span>{media.progress === 100 ? "Upload complete" : "Uploading replacement"}</span><span>{media.progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#e8ebdf]"><div className="h-full bg-[var(--k-lime)] transition-[width]" style={{ width: `${media.progress}%` }} /></div></div> : null}
          {media.error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><span>{media.error}</span>{media.canRetry ? <button type="button" disabled={media.isUploading} className="rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-extrabold" onClick={async () => { const asset = await media.retryLast(); if (asset) applyUploadedImage(asset, media.lastFileName ?? "Image"); }}>Retry upload</button> : null}</div> : null}
          {field("alt", "Alt text", "Describe the image")}
          {field("href", "Link (optional)", "https://…")}
        </div>
      );
    case "YOUTUBE":
      return field("videoId", "YouTube video ID", "dQw4w9WgXcQ");
    case "SPOTIFY":
      return field("url", "Spotify URL", "https://open.spotify.com/…");
    case "EMAIL":
      return field("email", "Email", "you@example.com", "email");
    case "PHONE":
      return field("number", "Phone", "+1 555 0100", "tel");
    case "LOCATION":
      return field("query", "Location", "Paris, France");
    case "WHATSAPP":
      return <div className="grid gap-3">{field("label", "Button label", "Chat on WhatsApp")}{field("phoneNumber", "Phone number", "+919999999999", "tel")}{field("messageTemplate", "Prefilled message", "Hi, I found your Kachko page.")}{field("service", "Service (optional)", "website design")}{field("campaign", "Campaign (optional)", "instagram")}<a className="truncate rounded-xl bg-[#f7f8f3] px-3 py-2 text-xs font-bold text-[#718c1b] underline" href={whatsappUrl(content)} target="_blank" rel="noopener noreferrer">Preview WhatsApp link ↗</a><p className="text-[11px] text-[#9a9f9b]">Supported message placeholders: {"{{page}}"}, {"{{service}}"}, and {"{{campaign}}"}.</p></div>;
    case "FORM":
    case "SUBSCRIBE":
      return <div className="rounded-xl border border-[#dfe2dc] bg-[#f7f8f3] p-3 text-sm text-[#646a66]">Manage the form title, fields, consent, and success message from <Link href="/dashboard/forms" className="font-extrabold text-[#718c1b] underline">Forms</Link>.</div>;
    case "SOCIAL":
      return (
        <div className="grid gap-3">
          <div>
            <label className="dash-label">Platform</label>
            <select
              className="dash-input"
              defaultValue={String(content.platform ?? "INSTAGRAM")}
              onChange={(e) => set("platform", e.target.value)}
            >
              {SOCIAL_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          {field("username", "Username", "yourhandle")}
        </div>
      );
    case "DIVIDER":
      return <p className="text-sm text-zinc-400">A subtle divider. No settings needed.</p>;
    default:
      return null;
  }
}

function whatsappUrl(content: Record<string, unknown>) {
  const phone = String(content.phoneNumber ?? "").replace(/\D/g, "");
  const message = String(content.messageTemplate ?? "")
    .replaceAll("{{page}}", "your Kachko page")
    .replaceAll("{{service}}", String(content.service ?? ""))
    .replaceAll("{{campaign}}", String(content.campaign ?? ""));
  return `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
