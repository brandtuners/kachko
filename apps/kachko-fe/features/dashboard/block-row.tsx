"use client";

// Light-theme dashboard rows (reference: kachko_dashboard.html `.link-row`):
// grip + lime brand chip + name/url + clicks + toggle + kebab. All mutations
// flow through useEditor (optimistic). Functionally identical to before —
// drag/keyboard reorder, visibility toggle, inline edit, delete — only the
// skin follows the new cream/lime system.
import { useState, useRef, useEffect } from "react";
import {
  BLOCK_LABELS,
  type BlockType,
  type EditorBlock,
} from "../editor/types";
import { BlockContentForm } from "../editor/block-content-form";
import { useEditor } from "../editor/use-editor";
import {
  IconDivider,
  IconGrip,
  IconImage,
  IconKebab,
  IconLink,
  IconPencil,
  IconPhone,
  IconPin,
  IconSend,
  IconSpotify,
  IconTrash,
  IconType,
  IconUsers,
  IconYoutube,
  SOCIAL_ICONS,
} from "../../components/icons";

export const BLOCK_ICONS: Record<BlockType, (p: { className?: string }) => JSX.Element> = {
  LINK: IconLink,
  TEXT: IconType,
  IMAGE: IconImage,
  SOCIAL: IconUsers,
  DIVIDER: IconDivider,
  YOUTUBE: IconYoutube,
  SPOTIFY: IconSpotify,
  EMAIL: IconSend,
  PHONE: IconPhone,
  LOCATION: IconPin,
};

export function blockTitle(block: EditorBlock): string {
  const c = block.content as Record<string, unknown>;
  if (block.type === "LINK") return String(c.title ?? "Untitled link");
  if (block.type === "TEXT") return String(c.text ?? "Text").slice(0, 40) || "Text";
  if (block.type === "IMAGE") return String(c.alt ?? "Image");
  if (block.type === "YOUTUBE") return String(c.title ?? "YouTube video");
  if (block.type === "SPOTIFY") return String(c.title ?? "Spotify");
  if (block.type === "EMAIL") return String(c.email ?? "Email");
  if (block.type === "PHONE") return String(c.number ?? "Phone");
  if (block.type === "LOCATION") return String(c.query ?? "Location");
  if (block.type === "SOCIAL") {
    const u = String(c.username ?? "").replace(/^@/, "");
    return u ? `${String(c.platform ?? "Social")} · @${u}` : String(c.platform ?? "Social");
  }
  return BLOCK_LABELS[block.type as BlockType] ?? "Block";
}

/** Second line of a block row — the destination, same order the public page
 *  uses. Used by the home "Your Links" list and the full editor. */
export function blockSub(block: EditorBlock): string {
  const c = block.content as Record<string, unknown>;
  const cut = (s: string) => (s.length > 44 ? `${s.slice(0, 44)}…` : s);
  switch (block.type) {
    case "LINK":
      return String(c.url ?? "");
    case "SOCIAL": {
      const u = String(c.username ?? "").replace(/^@/, "");
      return u ? `@${u}` : "";
    }
    case "TEXT":
      return "Text block";
    case "IMAGE":
      return String(c.url ?? "").startsWith("data:") ? "Placeholder image — set a URL" : cut(String(c.url ?? ""));
    case "YOUTUBE":
      return `youtube.com/watch?v=${String(c.videoId ?? "")}`;
    case "SPOTIFY":
      return cut(String(c.url ?? ""));
    case "EMAIL":
      return `mailto:${String(c.email ?? "")}`;
    case "PHONE":
      return `tel:${String(c.number ?? "")}`;
    case "LOCATION":
      return "Opens Google Maps";
    case "DIVIDER":
      return "Visual break";
    default:
      return "";
  }
}

/** Reference `.social` chip: 37px rounded-square in the platform's brand color. */
const PLATFORM_TILES: Record<string, string> = {
  INSTAGRAM: "linear-gradient(135deg,#7c39e9,#f32d7a 55%,#ffc837)",
  YOUTUBE: "#ff1c16",
  LINKEDIN: "#1477b9",
  FACEBOOK: "#1877f2",
  X: "#111312",
  TIKTOK: "#111312",
  GITHUB: "#24292f",
  DISCORD: "#5865f2",
  TWITCH: "#9146ff",
  SPOTIFY: "#1DB954",
};

export function PlatformBadge({ platform, size = 37 }: { platform: string; size?: number }) {
  const Icon = SOCIAL_ICONS[platform] ?? IconLink;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[11px] text-white"
      style={{
        width: size,
        height: size,
        background: PLATFORM_TILES[platform] ?? "#111312",
      }}
    >
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[21px] w-[38px] shrink-0 rounded-full p-[3px] transition-colors ${
        checked ? "flex justify-end bg-[#bce63c]" : "flex justify-start bg-[#d8dbd4]"
      }`}
    >
      <span className="h-[15px] w-[15px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.12)]" />
    </button>
  );
}

export function KebabMenu({ items }: { items: { label: string; icon?: JSX.Element; danger?: boolean; run: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-label="Block actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="k-icon-btn !h-8 !w-8"
      >
        <IconKebab className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl border border-[#e9ebe6] bg-white py-1 shadow-[0_18px_45px_rgba(18,24,18,.14)]">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={() => {
                setOpen(false);
                it.run();
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-semibold transition hover:bg-[#f6f7f2] ${
                it.danger ? "text-[#b4322c]" : "text-[var(--k-ink)]"
              }`}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DashBlockRow({
  block,
  index,
  count,
  onDragStartItem,
  onDropItem,
  onDragEndItem,
  isDragging,
  startEditing = false,
  onEditingChange,
  clicks,
}: {
  block: EditorBlock;
  index: number;
  count: number;
  onDragStartItem: (i: number) => void;
  onDropItem: (to: number) => void;
  onDragEndItem: () => void;
  isDragging?: boolean;
  // A freshly-added row opens straight into edit mode so the user can fill it in.
  startEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  // Real 7-day click count for this block (from top-links) — undefined = no data.
  clicks?: number;
}) {
  const editor = useEditor();
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState<Record<string, unknown>>(block.content);
  // Social rows wear the brand chip; everything else the block-type icon.
  const c = block.content as Record<string, unknown>;
  const Icon = BLOCK_ICONS[block.type as BlockType] ?? IconLink;

  const setEdit = (v: boolean) => {
    setEditing(v);
    onEditingChange?.(v);
  };

  const move = (delta: number) => {
    if (!editor.page) return;
    const ordered = [...editor.page.blocks].sort((a, b) => a.position - b.position).map((b) => b.id);
    const from = ordered.indexOf(block.id);
    const to = from + delta;
    if (to < 0 || to >= ordered.length) return;
    const next = [...ordered];
    [next[from], next[to]] = [next[to]!, next[from]!];
    editor.moveBlock.mutate(next);
  };

  return (
    <div
      draggable={!editing}
      onDragStart={() => onDragStartItem(index)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDropItem(index);
      }}
      onDragEnd={onDragEndItem}
      className={`transition ${isDragging ? "opacity-40" : ""} ${editing ? "rounded-[14px] border border-[#e9ebe6] bg-[#fbfaf6] p-3" : ""}`}
    >
      <div
        className={`grid items-center gap-3 ${
          editing ? "" : "h-[62px] rounded-[14px] border border-[#eceee9] bg-white px-3 hover:border-[#dfe2dc]"
        }`}
        style={editing ? undefined : { gridTemplateColumns: "26px 46px minmax(0,1fr) auto auto auto auto" }}
      >
        <span className="cursor-grab select-none text-[#c3c8c2]" aria-hidden title="Drag to reorder">
          <IconGrip className="h-4 w-4" />
        </span>
        {block.type === "SOCIAL" ? (
          <PlatformBadge platform={String(c.platform ?? "")} />
        ) : (
          <span className="k-tile-icon">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-extrabold text-[var(--k-ink)]">{blockTitle(block)}</p>
          <p className="truncate text-[10px] text-[#9a9f9b]">
            {blockSub(block)}
            {!block.isVisible ? " · hidden" : ""}
          </p>
        </div>
        {typeof clicks === "number" ? (
          <span className="hidden shrink-0 items-center gap-1.5 text-[11px] font-bold text-[#77951a] sm:flex" title="Link clicks, last 7 days">
            {clicks.toLocaleString()}
          </span>
        ) : null}
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => move(-1)}
            className="k-icon-btn !h-7 !w-7 text-xs disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={index === count - 1}
            onClick={() => move(1)}
            className="k-icon-btn !h-7 !w-7 text-xs disabled:opacity-30"
          >
            ↓
          </button>
        </div>
        <Toggle
          checked={block.isVisible}
          label={`Show ${blockTitle(block)}`}
          onChange={(v) => editor.editBlock.mutate({ id: block.id, data: { isVisible: v } })}
        />
        <KebabMenu
          items={[
            {
              label: editing ? "Close" : "Edit",
              icon: <IconPencil className="h-4 w-4" />,
              run: () => {
                setDraft(block.content);
                setEdit(!editing);
              },
            },
            {
              label: "Delete",
              icon: <IconTrash className="h-4 w-4" />,
              danger: true,
              run: () => editor.removeBlock.mutate(block.id),
            },
          ]}
        />
      </div>

      {editing ? (
        <div className="mt-3 grid gap-3">
          <div className="[&_input]:!bg-white [&_label]:!text-[#737975] [&_select]:!bg-white [&_textarea]:!bg-white [&_.input-bright]:!border-[#dfe2dc] [&_.input-bright]:!text-[var(--k-ink)] [&_.input-bright]:!placeholder:text-[#9a9f9b]">
            <BlockContentForm type={block.type as BlockType} initial={block.content} onChange={setDraft} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="k-btn-ink"
              disabled={editor.editBlock.isPending}
              onClick={() => {
                editor.editBlock.mutate({ id: block.id, data: { content: draft } });
                setEdit(false);
              }}
            >
              {editor.editBlock.isPending ? "Saving…" : "Save changes"}
            </button>
            <button type="button" className="k-btn-line" onClick={() => setEdit(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
