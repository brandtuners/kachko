"use client";

import { useState } from "react";
import { SOCIAL_PLATFORMS, type BlockType } from "./types";
import { useMediaUpload } from "./use-media-upload";

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
  const set = (key: string, value: unknown) => {
    const next = { ...content, [key]: value };
    if (type === "IMAGE") delete next.url;
    setContent(next);
    onChange(next);
  };

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
    case "LINK":
      return (
        <div className="grid gap-3">
          {field("title", "Title", "My favorite link")}
          {field("url", "URL", "https://…")}
        </div>
      );
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
                const next = { ...content, mediaId: asset.id, url: asset.url, alt: String(content.alt || file.name) };
                setContent(next);
                const { url: _url, ...payload } = next;
                void _url;
                onChange(payload);
              }} />
          </label>
          {media.error ? <p role="alert" className="text-sm text-red-700">{media.error}</p> : null}
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
