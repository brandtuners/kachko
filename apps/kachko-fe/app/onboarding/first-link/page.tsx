"use client";

// Step 04 — first link (reference: "sign up process 04.png").
// "What link do you want to share first?" — big URL field with a Paste action
// plus the three source tiles. Creating it writes a real LINK block via the API
// so the dashboard opens with content already in place.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addBlock, ensurePage } from "../../../features/editor/api";
import { ObShell } from "../../../features/onboarding/ob-shell";
import { useOnboarding } from "../../../features/onboarding/store";
import { IconClipboard, IconGlobe, IconLink, IconUpload } from "../../../components/icons";

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export default function OnboardingFirstLinkStep() {
  const router = useRouter();
  const store = useOnboarding();
  const [url, setUrl] = useState(store.firstLink);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const invalid = !!url && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(normalizeUrl(url));
  const disabled = !url.trim() || invalid;

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
    } catch {
      setToast("Clipboard unavailable — type the link instead.");
      setTimeout(() => setToast(null), 2200);
    }
  };

  const next = async () => {
    if (disabled || saving) return;
    setSaving(true);
    const clean = normalizeUrl(url);
    store.set("firstLink", clean);
    if (!store.linkBlockCreated) {
      try {
        const page = await ensurePage();
        await addBlock(page.id, "LINK", { title: "My first link", url: clean });
        store.set("linkBlockCreated", true);
      } catch {
        setToast("Couldn't save that link — you can add it from the dashboard.");
        setTimeout(() => setToast(null), 2400);
      }
    }
    router.push("/onboarding/title");
  };

  const skip = () => router.push("/onboarding/title");

  const sources = [
    { icon: IconGlobe, label: "Add from the web", hint: "Find any page and paste its address", run: () => {} },
    { icon: IconUpload, label: "Upload from your files", hint: "Links to files are supported later", run: () => {} },
    { icon: IconClipboard, label: "Paste a link", hint: "Use the clipboard button above", run: paste },
  ];

  return (
    <ObShell
      step={4}
      title="What link do you want to share first?"
      subtitle="Choose from the web, your files, or paste a link."
      onNext={next}
      nextDisabled={disabled}
      nextLoading={saving}
      onBack={() => router.back()}
      onSkip={skip}
    >
      <div className="grid gap-6">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9a9f9b]">
            <IconLink className="h-5 w-5" />
          </span>
          <input
            className="ob-input pr-24 pl-12 text-base"
            inputMode="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="button"
            onClick={paste}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-[#dfe2dc] bg-[#f6f7f2] px-3.5 py-2 text-sm font-bold text-[var(--k-ink)] transition hover:bg-[#eceee8]"
          >
            Paste
          </button>
        </div>
        {invalid ? <p className="-mt-4 text-xs font-medium text-[#b4322c]">That doesn’t look like a URL yet.</p> : null}

        <div className="grid gap-3 sm:grid-cols-3">
          {sources.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.run}
              className="ob-tile flex-col items-start gap-1.5"
            >
              <s.icon className="h-5 w-5 text-[#5c615d]" />
              <span>{s.label}</span>
              <span className="text-xs font-normal text-[var(--k-muted)]">{s.hint}</span>
            </button>
          ))}
        </div>

        {toast ? <p className="text-sm text-[var(--k-muted)]">{toast}</p> : null}
      </div>
    </ObShell>
  );
}
