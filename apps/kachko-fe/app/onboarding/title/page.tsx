"use client";

// Step 05 — page title (reference: "sign up process 05.png").
// "Give your page a title" — single big input. Persisted via the pages API
// (ensurePage creates the owner's page on first call if it doesn't exist yet).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ensurePage, updatePageMeta } from "../../../features/editor/api";
import { ObShell } from "../../../features/onboarding/ob-shell";
import { useOnboarding } from "../../../features/onboarding/store";

export default function OnboardingTitleStep() {
  const router = useRouter();
  const store = useOnboarding();
  const [title, setTitle] = useState(store.pageTitle);
  const [saving, setSaving] = useState(false);

  const next = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    store.set("pageTitle", title.trim());
    try {
      const page = await ensurePage();
      await updatePageMeta(page.id, { title: title.trim() });
    } catch {
      /* dashboard will surface it */
    }
    router.push("/onboarding/goal");
  };

  return (
    <ObShell
      step={5}
      title="Give your page a title"
      subtitle="You can change this anytime."
      onNext={next}
      nextDisabled={!title.trim()}
      nextLoading={saving}
      onBack={() => router.back()}
    >
      <input
        className="ob-input py-5 text-xl"
        placeholder="e.g. Alex’s corner of the internet"
        maxLength={80}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && next()}
        autoFocus
      />
      <p className="mt-3 text-right text-xs text-[var(--k-muted)]">{80 - Math.min(title.length, 80)} characters left</p>
    </ObShell>
  );
}
