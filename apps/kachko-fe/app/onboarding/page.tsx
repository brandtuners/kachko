"use client";

// Step 01 — name (reference: "sign up process 01.png"). "Tell us about yourself"
// eyebrow, First/Last fields with a characters-left hint. Persists displayName
// via PATCH /users/me, then moves forward.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "../../lib/api";
import { ObShell } from "../../features/onboarding/ob-shell";
import { useOnboarding } from "../../features/onboarding/store";

const NAME_MAX = 33;

export default function OnboardingNameStep() {
  const router = useRouter();
  const store = useOnboarding();
  const [first, setFirst] = useState(store.firstName);
  const [last, setLast] = useState(store.lastName);
  const [saving, setSaving] = useState(false);

  const disabled = !first.trim();

  const next = async () => {
    if (disabled || saving) return;
    setSaving(true);
    store.set("firstName", first.trim());
    store.set("lastName", last.trim());
    const displayName = `${first.trim()} ${last.trim()}`.trim().slice(0, 80);
    try {
      await apiFetch("/users/me", { method: "PATCH", body: JSON.stringify({ displayName }) });
    } catch {
      /* name is non-critical; dashboard can still set it */
    }
    router.push("/onboarding/categories");
  };

  return (
    <ObShell
      step={1}
      title="First name?"
      subtitle="This is the name people see on your page."
      onNext={next}
      nextDisabled={disabled}
      nextLoading={saving}
      backHref="/register"
    >
      <p className="mb-4 text-xs font-bold uppercase tracking-[4px] text-[#8b918d]">Tell us about yourself</p>
      <div className="grid gap-5">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="first" className="text-sm font-bold text-[var(--k-ink)]">
              First Name
            </label>
            <span className="text-xs text-[var(--k-muted)]">{NAME_MAX - Math.min(first.length, NAME_MAX)} characters left</span>
          </div>
          <input
            id="first"
            className="ob-input"
            maxLength={NAME_MAX}
            autoComplete="given-name"
            placeholder="e.g. Alex"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="last" className="mb-2 block text-sm font-bold text-[var(--k-ink)]">
            Last Name
          </label>
          <input
            id="last"
            className="ob-input"
            maxLength={NAME_MAX}
            autoComplete="family-name"
            placeholder="Optional"
            value={last}
            onChange={(e) => setLast(e.target.value)}
          />
        </div>
      </div>
    </ObShell>
  );
}
