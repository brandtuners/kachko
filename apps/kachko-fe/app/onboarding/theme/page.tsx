"use client";

// Step 07 — theme (reference: "sign up process 07.png").
// "Choose a look" — grid of phone-like preview cards rendered from the real
// Theme rows (background gradient JSON). Persisted via PATCH /pages/me/theme.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listThemes, setTheme, ensurePage } from "../../../features/editor/api";
import type { EditorTheme } from "../../../features/editor/types";
import { ObShell } from "../../../features/onboarding/ob-shell";
import { useOnboarding } from "../../../features/onboarding/store";
import { IconCheck } from "../../../components/icons";

function themeBackground(t: EditorTheme): string {
  const b = t.background ?? {};
  if (b.from && b.to) return `linear-gradient(160deg, ${b.from}, ${b.to})`;
  if (b.from) return b.from;
  // Deterministic fallbacks keyed by slug so cards look distinct.
  const palettes = [
    "linear-gradient(160deg,#6c5cff,#ff3df0)",
    "linear-gradient(160deg,#0e0c1d,#22e3ff)",
    "linear-gradient(160deg,#ffd23d,#ff5e7a)",
    "linear-gradient(160deg,#111827,#6c5cff)",
    "linear-gradient(160deg,#f4f2ff,#a79fd6)",
    "linear-gradient(160deg,#052e16,#9dff3d)",
  ];
  const idx = [...(t.slug ?? t.name)].reduce((a, c) => a + c.charCodeAt(0), 0) % palettes.length;
  return palettes[idx]!;
}

export default function OnboardingThemeStep() {
  const router = useRouter();
  const store = useOnboarding();
  const themes = useQuery({ queryKey: ["themes"], queryFn: listThemes });
  const [picked, setPicked] = useState<string | null>(store.themeId);
  const [saving, setSaving] = useState(false);

  const next = async () => {
    if (!picked || saving) return;
    setSaving(true);
    store.set("themeId", picked);
    try {
      const page = await ensurePage();
      await setTheme(page.id, picked);
    } catch {
      /* dashboard can re-pick */
    }
    router.push("/onboarding/done");
  };

  const skip = () => router.push("/onboarding/done");

  return (
    <ObShell
      step={7}
      title="Pick a look for your page"
      subtitle="Preview only — you can change the theme anytime."
      onNext={next}
      nextDisabled={!picked}
      nextLoading={saving}
      onBack={() => router.back()}
      onSkip={skip}
    >
      {themes.isLoading ? (
        <p className="text-sm text-[var(--k-muted)]">Loading themes…</p>
      ) : themes.isError ? (
        <p className="text-sm text-[var(--k-muted)]">Couldn’t load themes — you can pick one later.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(themes.data ?? []).map((t) => {
            const active = picked === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => setPicked(t.id)}
                className={`rounded-2xl border bg-white p-2 text-left transition ${
                  active
                    ? "border-[#b5d936] shadow-[0_0_0_3px_rgba(200,242,74,0.22)]"
                    : "border-[#e6e8e1] hover:border-[#b5d936]"
                }`}
              >
                <div
                  className="relative overflow-hidden rounded-xl border border-black/5"
                  style={{ background: themeBackground(t), aspectRatio: "9 / 16" }}
                >
                  {/* Mini phone mock: avatar + two link bars */}
                  <div className="absolute inset-0 flex flex-col items-center gap-2 px-3 pt-6">
                    <span className="h-7 w-7 rounded-full bg-white/85" />
                    <span className="h-2 w-16 rounded-full bg-white/50" />
                    <span className="mt-3 h-5 w-full rounded-lg bg-white/30" />
                    <span className="h-5 w-full rounded-lg bg-white/20" />
                    <span className="h-5 w-full rounded-lg bg-white/10" />
                  </div>
                  {active ? (
                    <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[var(--k-lime)] text-[var(--k-ink)] shadow">
                      <IconCheck className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </div>
                <p className={`mt-2 truncate px-1 text-xs font-bold ${active ? "text-[var(--k-ink)]" : "text-[var(--k-text)]"}`}>{t.name}</p>
              </button>
            );
          })}
        </div>
      )}
    </ObShell>
  );
}
