"use client";

import { useEffect, useState } from "react";
import type { MediaAsset, PageTemplate, ThemeConfig } from "@kachko/types";
import { apiFetch, ApiClientError } from "../../lib/api";
import { IconArrowLeft, IconCheck, IconTrash } from "../../components/icons";
import { useEditor } from "../editor/use-editor";
import { useMediaUpload } from "../editor/use-media-upload";
import { PAGE_FONT_STACKS, themeBackground, themeButtonStyle, themeVars } from "../page/theme";

type View = "home" | "template" | "theme" | "wallpaper" | "buttons" | "text" | "colors" | "footer";

const VIEW_TITLES: Record<Exclude<View, "home">, string> = {
  template: "Templates", theme: "Theme", wallpaper: "Wallpaper", buttons: "Buttons", text: "Text", colors: "Colors", footer: "Footer",
};

const FONT_OPTIONS: Array<{ value: ThemeConfig["typography"]["fontFamily"]; label: string }> = [
  { value: "system", label: "System" }, { value: "manrope", label: "Manrope" },
  { value: "dmSans", label: "DM Sans" }, { value: "inter", label: "Inter" },
  { value: "lato", label: "Lato" }, { value: "poppins", label: "Poppins" },
  { value: "spaceGrotesk", label: "Space Grotesk" }, { value: "sans", label: "Arial" },
  { value: "verdana", label: "Verdana" }, { value: "trebuchet", label: "Trebuchet MS" },
  { value: "serif", label: "Georgia" }, { value: "lora", label: "Lora" },
  { value: "playfair", label: "Playfair Display" }, { value: "times", label: "Times New Roman" },
  { value: "palatino", label: "Palatino" }, { value: "mono", label: "Monospace" },
  { value: "spaceMono", label: "Space Mono" }, { value: "courier", label: "Courier New" },
];

function CardButton({ title, value, preview, onClick }: { title: string; value?: string; preview: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-4 rounded-2xl border border-[#e6e8e2] bg-white p-3 text-left shadow-[0_2px_7px_rgba(20,24,20,.04)] transition hover:border-[#cdd4c5] hover:shadow-[0_5px_14px_rgba(20,24,20,.07)]">
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#e4e7df] bg-[#f5f6f2]">{preview}</span>
      <span className="flex-1 text-sm font-extrabold text-[var(--k-ink)]">{title}</span>
      {value ? <span className="text-sm text-[#737973]">{value}</span> : null}
      <span aria-hidden className="text-2xl font-light text-[#a2a7a1]">›</span>
    </button>
  );
}

function BackHeader({ view, back }: { view: Exclude<View, "home">; back: () => void }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <button type="button" onClick={back} aria-label="Back to design" className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#f0f2ec]"><IconArrowLeft className="h-5 w-5" /></button>
      <h3 className="text-xl font-extrabold tracking-[-.5px] text-[var(--k-ink)]">{VIEW_TITLES[view]}</h3>
    </div>
  );
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 py-3 text-sm font-bold text-[#30342f]">
      {label}
      <span className="flex items-center gap-2 rounded-xl border border-[#e5e7e1] bg-white px-3 py-2 font-mono text-xs font-semibold">
        <input type="color" value={value.slice(0, 7)} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
        {value.toUpperCase()}
      </span>
    </label>
  );
}

const pageHasBlocks = (blocks: Array<unknown> | undefined) => Boolean(blocks?.length);

export function DesignPanel() {
  const editor = useEditor();
  const upload = useMediaUpload();
  const serverConfig = editor.page?.theme?.config;
  const [view, setView] = useState<View>("home");
  const [draft, setDraft] = useState<ThemeConfig | null>(serverConfig ?? null);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MediaAsset | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<PageTemplate | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => { if (serverConfig) setDraft(serverConfig); }, [serverConfig]);
  useEffect(() => {
    if (view !== "wallpaper" || mediaLoaded || mediaLoading) return;
    setMediaLoading(true);
    apiFetch<MediaAsset[]>("/media").then(setMedia).catch(() => setMediaError("Could not load your images.")).finally(() => { setMediaLoading(false); setMediaLoaded(true); });
  }, [view, mediaLoaded, mediaLoading]);

  if (!draft) return <p className="py-8 text-center text-sm text-[#8b918a]">Appearance settings are unavailable.</p>;

  const commit = (next: ThemeConfig) => {
    setDraft(next);
    editor.saveAppearance.mutate(next);
  };
  const withoutBackgroundImage = (background: ThemeConfig["background"]): ThemeConfig["background"] => {
    const { imageMediaId: _id, imageOpacity: _opacity, imageFit: _fit, imagePositionX: _x, imagePositionY: _y, ...rest } = background;
    void [_id, _opacity, _fit, _x, _y];
    return rest;
  };
  const deleteMedia = async (asset: MediaAsset) => {
    setMediaError(null);
    setDeletingMediaId(asset.id);
    try {
      if (draft.background.imageMediaId === asset.id) {
        const next = { ...draft, background: withoutBackgroundImage(draft.background) };
        setDraft(next);
        await editor.saveAppearance.mutateAsync(next);
      }
      await apiFetch(`/media/${encodeURIComponent(asset.id)}`, { method: "DELETE" });
      setMedia((items) => items.filter((item) => item.id !== asset.id));
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Could not delete this image.";
      setMediaError(error instanceof ApiClientError && error.code === "MEDIA_IN_USE" ? "This image is still used by your avatar or a content block. Remove it there first." : message);
    } finally {
      setDeletingMediaId(null);
      setPendingDelete(null);
    }
  };
  const backgroundColor = draft.background.type === "solid" ? draft.background.color : draft.background.from;
  const fontLabel = FONT_OPTIONS.find((font) => font.value === draft.typography.fontFamily)?.label ?? "System";

  if (view === "home") {
    return (
      <div className="grid gap-3">
        <CardButton title="Templates" value="Page layouts" preview={<span className="grid grid-cols-2 gap-1"><i className="h-3 w-3 rounded-sm bg-[#9fce23]" /><i className="h-3 w-3 rounded-sm bg-[#252a26]" /><i className="col-span-2 h-2 rounded-sm bg-[#dfe3d9]" /></span>} onClick={() => setView("template")} />
        <CardButton title="Theme" value={editor.themes.find((theme) => theme.id === editor.page?.themeId)?.name ?? editor.page?.themeId ?? "Custom"}
          preview={<span className="font-serif text-lg font-bold">Aa</span>} onClick={() => setView("theme")} />
        <p className="mb-0 mt-3 px-1 text-xs font-extrabold uppercase tracking-[.14em] text-[#777d76]">Customize</p>
        <CardButton title="Wallpaper" value={draft.background.imageMediaId ? "Image" : draft.background.type === "gradient" ? "Gradient" : "Fill"}
          preview={<span className="h-full w-full" style={{ background: themeBackground({ config: draft }) }} />} onClick={() => setView("wallpaper")} />
        <CardButton title="Buttons" value={draft.buttons.variant[0]!.toUpperCase() + draft.buttons.variant.slice(1)}
          preview={<span className="h-5 w-8 border" style={{ ...themeButtonStyle(), ...themeVars({ config: draft }) }} />} onClick={() => setView("buttons")} />
        <CardButton title="Text" value={fontLabel} preview={<span className="text-lg">Aa</span>} onClick={() => setView("text")} />
        <CardButton title="Colors" preview={<span className="flex h-full w-full">{[backgroundColor, draft.buttons.background, draft.buttons.color].map((color) => <i key={color} className="h-full flex-1" style={{ background: color }} />)}</span>} onClick={() => setView("colors")} />
        <CardButton title="Footer" value={draft.footer.visible ? "Shown" : "Hidden"} preview={<span className="text-[10px] font-semibold">KACHKO</span>} onClick={() => setView("footer")} />
        {(editor.saveAppearance.isError || editor.pickTheme.isError) ? <p role="alert" className="mt-2 text-xs font-semibold text-[#b4322c]">Could not save that design change. Please try again.</p> : null}
      </div>
    );
  }

  if (view === "template") {
    const apply = (template: PageTemplate, replaceExistingBlocks: boolean) => {
      setTemplateError(null);
      editor.applyTemplate.mutate(
        { templateKey: template.key, replaceExistingBlocks },
        {
          onSuccess: (page) => {
            if (page.theme?.config) setDraft(page.theme.config);
            setPendingTemplate(null);
            setView("home");
          },
          onError: (error) => {
            if (error instanceof ApiClientError && error.code === "TEMPLATE_REPLACE_REQUIRED") setPendingTemplate(template);
            else setTemplateError(error instanceof Error ? error.message : "Could not apply this template.");
          },
        },
      );
    };
    return <div><BackHeader view={view} back={() => setView("home")} />
      <p className="mb-4 text-sm text-[#737973]">Start from a ready-made design and block layout. You can customize everything afterward.</p>
      {editor.templatesLoading ? <p className="py-8 text-center text-sm text-[#8b918a]">Loading templates…</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {editor.templates.map((template) => {
          const theme = editor.themes.find((item) => item.id === template.themeKey);
          return <button key={template.key} type="button" disabled={editor.applyTemplate.isPending} onClick={() => pageHasBlocks(editor.page?.blocks) ? setPendingTemplate(template) : apply(template, false)} className="overflow-hidden rounded-2xl border-2 border-[#e4e7df] bg-white text-left transition hover:border-[#9fce23] disabled:opacity-60">
            <span className="relative block h-32 p-4" style={theme ? { ...themeVars(theme), background: themeBackground(theme) } : undefined}>
              <span className="block text-lg font-extrabold text-[color:var(--page-title-color,var(--page-text,#111312))]">Aa</span>
              <span className="mt-5 block h-7 rounded-[var(--page-button-radius,12px)] border border-[color:var(--page-button-bg,#111312)]" />
              <span className="mt-2 block h-5 w-4/5 rounded-[var(--page-button-radius,12px)] border border-[color:var(--page-button-bg,#111312)]" />
            </span>
            <span className="block p-3"><span className="block text-sm font-extrabold text-[#111312]">{template.name}</span><span className="mt-1 block text-xs leading-relaxed text-[#737973]">{template.description}</span><span className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-[#8c928b]">{template.blocks.length} starter blocks</span></span>
          </button>;
        })}
      </div>
      {templateError ? <p role="alert" className="mt-3 text-sm font-semibold text-[#b4322c]">{templateError}</p> : null}
      {pendingTemplate ? <div className="fixed inset-0 z-[100] grid place-items-center bg-[#111312]/45 px-5 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !editor.applyTemplate.isPending) setPendingTemplate(null); }}>
        <div role="alertdialog" aria-modal="true" aria-labelledby="replace-template-title" aria-describedby="replace-template-description" className="w-full max-w-md rounded-[24px] border border-[#dfe3d9] bg-[#fbfaf6] p-6 shadow-[0_24px_80px_rgba(17,19,18,.28)]">
          <h4 id="replace-template-title" className="text-lg font-extrabold tracking-[-.3px] text-[#111312]">Apply {pendingTemplate.name}?</h4>
          <p id="replace-template-description" className="mt-2 text-sm leading-relaxed text-[#697069]">This replaces every existing block on this page and applies the template theme. This action cannot be undone.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" autoFocus disabled={editor.applyTemplate.isPending} onClick={() => setPendingTemplate(null)} className="k-btn-line !rounded-full disabled:opacity-50">Cancel</button>
            <button type="button" disabled={editor.applyTemplate.isPending} onClick={() => apply(pendingTemplate, true)} className="rounded-full bg-[#111312] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-60">{editor.applyTemplate.isPending ? "Applying…" : "Replace and apply"}</button>
          </div>
        </div>
      </div> : null}
    </div>;
  }

  if (view === "theme") return (
    <div><BackHeader view={view} back={() => setView("home")} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {editor.themes.map((theme) => {
          const active = theme.id === editor.page?.themeId;
          return <button key={theme.id} type="button" disabled={editor.pickTheme.isPending} onClick={() => editor.pickTheme.mutate(theme.id)} className="text-left">
            <span className={`relative block aspect-[4/5] overflow-hidden rounded-2xl border-2 ${active ? "border-[#9fce23]" : "border-[#e5e7e1]"}`} style={{ ...themeVars(theme), background: themeBackground(theme) }}>
              <span className="absolute left-3 top-3 text-2xl font-bold text-[color:var(--page-title-color,var(--page-text))]">Aa</span>
              <span className="absolute inset-x-3 bottom-4 h-10 border" style={themeButtonStyle()} />
              {active ? <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#111312] text-white"><IconCheck className="h-3.5 w-3.5" /></span> : null}
            </span>
            <span className="mt-1.5 block text-center text-xs font-bold text-[#565c56]">{theme.name}</span>
          </button>;
        })}
      </div>
    </div>
  );

  if (view === "wallpaper") {
    const solidBackground = draft.background.type === "solid" ? draft.background : null;
    const gradientBackground = draft.background.type === "gradient" ? draft.background : null;
    const setSolid = () => commit({ ...draft, background: { type: "solid", color: backgroundColor } });
    const setGradient = () => commit({ ...draft, background: { type: "gradient", from: backgroundColor, to: draft.background.type === "gradient" ? draft.background.to : "#111312", angle: draft.background.type === "gradient" ? draft.background.angle : 180 } });
    return <div><BackHeader view={view} back={() => setView("home")} />
      <p className="mb-2 text-xs font-bold text-[#515750]">Wallpaper style</p>
      <div className="grid grid-cols-3 gap-2">
        {[{ key: "solid", label: "Fill" }, { key: "gradient", label: "Gradient" }, { key: "image", label: "Image" }].map((item) => {
          const active = item.key === "image" ? Boolean(draft.background.imageMediaId) : !draft.background.imageMediaId && draft.background.type === item.key;
          return <button key={item.key} type="button" onClick={item.key === "solid" ? setSolid : item.key === "gradient" ? setGradient : undefined}
            className={`rounded-xl border-2 p-1.5 ${active ? "border-[#9fce23]" : "border-[#e4e7df]"}`}>
            <span className="block h-14 rounded-lg" style={{ background: item.key === "gradient" ? `linear-gradient(180deg, ${backgroundColor}, #111312)` : item.key === "image" ? "#eef0ea" : backgroundColor }} />
            <span className="mt-1.5 block text-xs font-bold">{item.label}</span>
          </button>;
        })}
      </div>

      {solidBackground && !solidBackground.imageMediaId ? <div className="mt-5"><ColorControl label="Fill color" value={solidBackground.color} onChange={(color) => commit({ ...draft, background: { ...solidBackground, color } })} /></div> : null}
      {gradientBackground && !gradientBackground.imageMediaId ? <div className="mt-5 space-y-2">
        <ColorControl label="Start color" value={gradientBackground.from} onChange={(from) => commit({ ...draft, background: { ...gradientBackground, from } })} />
        <ColorControl label="End color" value={gradientBackground.to} onChange={(to) => commit({ ...draft, background: { ...gradientBackground, to } })} />
        <label className="block py-3 text-sm font-bold">Direction: {gradientBackground.angle}°<input type="range" min="0" max="360" step="15" value={gradientBackground.angle} onChange={(event) => setDraft({ ...draft, background: { ...gradientBackground, angle: Number(event.target.value) } })} onPointerUp={() => commit(draft)} className="mt-2 w-full accent-[#9fce23]" /></label>
      </div> : null}

      <div className="mt-5 rounded-2xl border border-[#e5e7e1] bg-[#fafbf7] p-3">
        <div className="flex items-center justify-between gap-3"><p className="text-sm font-extrabold">Image</p>
          <label className="k-btn-line !rounded-full cursor-pointer !px-3 !py-2 text-xs">{upload.isUploading ? "Uploading…" : "Upload new"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={upload.isUploading} onChange={async (event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (!file) return; const asset = await upload.uploadImage(file); if (!asset) return; setMedia((items) => [asset, ...items]); commit({ ...draft, background: { ...draft.background, imageMediaId: asset.id, imageOpacity: draft.background.imageOpacity ?? .35, imageFit: draft.background.imageFit ?? "cover", imagePositionX: draft.background.imagePositionX ?? 50, imagePositionY: draft.background.imagePositionY ?? 50 } }); }} /></label>
        </div>
        {mediaLoading ? <p className="py-5 text-center text-xs text-[#858b84]">Loading images…</p> : null}
        {media.length ? <div className="mt-3 grid max-h-48 grid-cols-4 gap-2 overflow-y-auto">{media.map((asset) => (
          <div key={asset.id} className={`group relative aspect-square overflow-hidden rounded-lg border-2 ${draft.background.imageMediaId === asset.id ? "border-[#9fce23]" : "border-transparent"}`}>
            <button type="button" aria-label={`Use image ${asset.width} by ${asset.height}`} onClick={() => commit({ ...draft, background: { ...draft.background, imageMediaId: asset.id, imageOpacity: draft.background.imageOpacity ?? .35, imageFit: draft.background.imageFit ?? "cover", imagePositionX: draft.background.imagePositionX ?? 50, imagePositionY: draft.background.imagePositionY ?? 50 } })} className="h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/v1/media/files/${encodeURIComponent(asset.id)}`} alt="" className="h-full w-full object-cover" />
            </button>
            <button type="button" aria-label="Delete image permanently" title="Delete permanently" disabled={deletingMediaId !== null} onClick={() => setPendingDelete(asset)} className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/65 text-white opacity-100 shadow-sm backdrop-blur transition hover:bg-[#b4322c] disabled:cursor-wait disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
              {deletingMediaId === asset.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <IconTrash className="h-4 w-4" />}
            </button>
          </div>
        ))}</div> : null}
        {mediaError ? <p className="mt-2 text-xs text-[#b4322c]">{mediaError}</p> : null}
        {draft.background.imageMediaId ? <div className="mt-4 space-y-3">
          <div className="flex rounded-lg bg-[#ecefe8] p-1">{(["cover", "contain"] as const).map((fit) => <button key={fit} type="button" onClick={() => commit({ ...draft, background: { ...draft.background, imageFit: fit } })} className={`flex-1 rounded-md py-1.5 text-xs font-bold capitalize ${draft.background.imageFit === fit ? "bg-white shadow-sm" : "text-[#747a74]"}`}>{fit}</button>)}</div>
          {(["imagePositionX", "imagePositionY"] as const).map((key) => <label key={key} className="block text-xs font-bold text-[#596158]">{key === "imagePositionX" ? "Horizontal" : "Vertical"} position: {draft.background[key] ?? 50}%<input type="range" min="0" max="100" step="5" value={draft.background[key] ?? 50} onChange={(event) => setDraft({ ...draft, background: { ...draft.background, [key]: Number(event.target.value) } })} onPointerUp={() => commit(draft)} className="mt-1 w-full accent-[#9fce23]" /></label>)}
          <label className="block text-xs font-bold text-[#596158]">Visibility: {Math.round((draft.background.imageOpacity ?? .35) * 100)}%<input type="range" min=".1" max=".8" step=".05" value={draft.background.imageOpacity ?? .35} onChange={(event) => setDraft({ ...draft, background: { ...draft.background, imageOpacity: Number(event.target.value) } })} onPointerUp={() => commit(draft)} className="mt-1 w-full accent-[#9fce23]" /></label>
          <button type="button" className="text-xs font-bold text-[#b4322c]" onClick={() => commit({ ...draft, background: withoutBackgroundImage(draft.background) })}>Remove from wallpaper</button>
        </div> : null}
      </div>
      {pendingDelete ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-[#111312]/45 px-5 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingMediaId) setPendingDelete(null); }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-image-title" aria-describedby="delete-image-description" className="w-full max-w-md rounded-[24px] border border-[#dfe3d9] bg-[#fbfaf6] p-6 shadow-[0_24px_80px_rgba(17,19,18,.28)]">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fee9e7] text-[#b4322c]"><IconTrash className="h-5 w-5" /></span>
              <div>
                <h4 id="delete-image-title" className="text-lg font-extrabold tracking-[-.3px] text-[#111312]">Delete this image?</h4>
                <p id="delete-image-description" className="mt-1.5 text-sm leading-relaxed text-[#697069]">It will be permanently removed from Kachko storage. This action cannot be undone.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" autoFocus disabled={Boolean(deletingMediaId)} onClick={() => setPendingDelete(null)} className="k-btn-line !rounded-full disabled:opacity-50">Cancel</button>
              <button type="button" disabled={Boolean(deletingMediaId)} onClick={() => void deleteMedia(pendingDelete)} className="inline-flex min-w-[128px] items-center justify-center gap-2 rounded-full bg-[#b4322c] px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#942a25] disabled:cursor-wait disabled:opacity-70">
                {deletingMediaId ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Deleting…</> : "Delete image"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>;
  }

  if (view === "buttons") return <div><BackHeader view={view} back={() => setView("home")} />
    <p className="mb-2 text-xs font-bold">Button style</p><div className="grid grid-cols-3 gap-2">{(["filled", "glass", "outline"] as const).map((variant) => <button key={variant} type="button" onClick={() => commit({ ...draft, buttons: { ...draft.buttons, variant } })} className={`rounded-xl border-2 p-2 ${draft.buttons.variant === variant ? "border-[#111312]" : "border-[#e4e7df]"}`}><span className="mx-auto block h-7 w-4/5 border" style={{ borderRadius: draft.buttons.radius, background: variant === "outline" ? "transparent" : variant === "glass" ? "#dfe3df99" : draft.buttons.background, borderColor: draft.buttons.background }} /><span className="mt-2 block text-xs font-bold capitalize">{variant}</span></button>)}</div>
    <p className="mb-2 mt-6 text-xs font-bold">Corner roundness</p><div className="grid grid-cols-5 gap-2">{[0, 8, 16, 24, 32].map((radius) => <button key={radius} type="button" aria-label={`${radius}px corners`} title={`${radius}px`} onClick={() => commit({ ...draft, buttons: { ...draft.buttons, radius } })} className={`group grid h-12 place-items-center rounded-xl border-2 transition ${draft.buttons.radius === radius ? "border-[#111312] bg-[#f5f6f2]" : "border-[#e4e7df] bg-white hover:border-[#aeb4ac]"}`}><span aria-hidden className={`block h-6 w-6 border-l-2 border-t-2 transition ${draft.buttons.radius === radius ? "border-[#111312]" : "border-[#7d837c] group-hover:border-[#111312]"}`} style={{ borderTopLeftRadius: `${Math.min(radius, 20)}px` }} /></button>)}</div>
    <p className="mb-2 mt-6 text-xs font-bold">Button shadow</p><div className="grid grid-cols-2 gap-2">{[{ value: false, label: "None" }, { value: true, label: "Soft" }].map((option) => <button key={option.label} type="button" onClick={() => commit({ ...draft, buttons: { ...draft.buttons, shadow: option.value } })} className={`rounded-xl border-2 py-3 text-sm font-bold ${draft.buttons.shadow === option.value ? "border-[#111312]" : "border-[#e4e7df]"}`}>{option.label}</button>)}</div>
    <div className="mt-5"><ColorControl label="Button color" value={draft.buttons.background} onChange={(background) => commit({ ...draft, buttons: { ...draft.buttons, background } })} /><ColorControl label="Button text color" value={draft.buttons.color} onChange={(color) => commit({ ...draft, buttons: { ...draft.buttons, color } })} /></div>
  </div>;

  if (view === "text") return <div><BackHeader view={view} back={() => setView("home")} />
    <p className="mb-3 text-xs font-bold text-[#515750]">Page font</p>
    <div className="grid max-h-[360px] grid-cols-2 gap-2 overflow-y-auto pr-1">{FONT_OPTIONS.map((font) => <button key={font.value} type="button" aria-pressed={draft.typography.fontFamily === font.value} onClick={() => commit({ ...draft, typography: { ...draft.typography, fontFamily: font.value } })} className={`relative min-h-14 rounded-xl border-2 px-3 py-3 text-center text-sm transition ${draft.typography.fontFamily === font.value ? "border-[#111312] bg-white shadow-sm" : "border-transparent bg-[#f0f1ed] hover:border-[#cbd0c8]"}`} style={{ fontFamily: PAGE_FONT_STACKS[font.value] }}>{font.label}{draft.typography.fontFamily === font.value ? <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#9fce23] text-[#111312]"><IconCheck className="h-3 w-3" /></span> : null}</button>)}</div>
    <label className="mt-4 block text-sm font-bold">Title size: {draft.typography.titleSize}px<input type="range" min="20" max="48" value={draft.typography.titleSize} onChange={(event) => setDraft({ ...draft, typography: { ...draft.typography, titleSize: Number(event.target.value) } })} onPointerUp={() => commit(draft)} className="mt-2 w-full accent-[#9fce23]" /></label>
    <div className="mt-5"><ColorControl label="Page text color" value={draft.typography.color} onChange={(color) => commit({ ...draft, typography: { ...draft.typography, color } })} /><ColorControl label="Title color" value={draft.typography.titleColor ?? draft.typography.color} onChange={(titleColor) => commit({ ...draft, typography: { ...draft.typography, titleColor } })} /></div>
  </div>;

  if (view === "colors") {
    const gradientBackground = draft.background.type === "gradient" ? draft.background : null;
    return <div><BackHeader view={view} back={() => setView("home")} />
    <ColorControl label={draft.background.type === "solid" ? "Background" : "Gradient start"} value={backgroundColor} onChange={(color) => commit({ ...draft, background: draft.background.type === "solid" ? { ...draft.background, color } : { ...draft.background, from: color } })} />
    {gradientBackground ? <ColorControl label="Gradient end" value={gradientBackground.to} onChange={(to) => commit({ ...draft, background: { ...gradientBackground, to } })} /> : null}
    <ColorControl label="Buttons" value={draft.buttons.background} onChange={(background) => commit({ ...draft, buttons: { ...draft.buttons, background } })} /><ColorControl label="Button text" value={draft.buttons.color} onChange={(color) => commit({ ...draft, buttons: { ...draft.buttons, color } })} /><ColorControl label="Page text" value={draft.typography.color} onChange={(color) => commit({ ...draft, typography: { ...draft.typography, color } })} /><ColorControl label="Title" value={draft.typography.titleColor ?? draft.typography.color} onChange={(titleColor) => commit({ ...draft, typography: { ...draft.typography, titleColor } })} />
  </div>;
  }

  return <div><BackHeader view="footer" back={() => setView("home")} />
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#e5e7e1] bg-white p-4 text-sm font-bold">
      <span><span className="block">Show “Made with KACHKO”</span><span className="mt-1 block text-xs font-normal text-[#818780]">The report link always remains available.</span></span>
      <button type="button" role="switch" aria-label="Show Made with KACHKO footer" aria-checked={draft.footer.visible} onClick={() => commit({ ...draft, footer: { visible: !draft.footer.visible } })} className={`relative h-7 w-12 shrink-0 rounded-full transition ${draft.footer.visible ? "bg-[#9fce23]" : "bg-[#a9aea7]"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${draft.footer.visible ? "left-6" : "left-1"}`} /></button>
    </label>
  </div>;
}
