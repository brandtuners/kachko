"use client";

// Step 02 — categories (reference: "sign up process 02.png").
// "How would you describe yourself?" — multi-select chip grid, up to 3.
// Client-only answer (no API field yet); shown as flavor on the dashboard hero.
import { useRouter } from "next/navigation";
import { ObShell } from "../../../features/onboarding/ob-shell";
import { useOnboarding, CATEGORIES } from "../../../features/onboarding/store";
import { IconCheck } from "../../../components/icons";

export default function OnboardingCategoriesStep() {
  const router = useRouter();
  const { categories, toggleCategory } = useOnboarding();

  const next = () => router.push("/onboarding/platform");
  const skip = () => router.push("/onboarding/platform");

  return (
    <ObShell
      step={2}
      title="How would you describe yourself?"
      subtitle="Select up to 3 — this helps us suggest blocks and themes you'll actually use."
      onNext={next}
      nextLabel={categories.length ? "Continue" : "Continue"}
      onBack={() => router.back()}
      onSkip={skip}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CATEGORIES.map((c) => {
          const active = categories.includes(c);
          const blocked = !active && categories.length >= 3;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              disabled={blocked}
              onClick={() => toggleCategory(c)}
              className={`ob-tile flex-col items-start gap-2 ${active ? "ob-tile-active" : ""} ${
                blocked ? "cursor-not-allowed opacity-40" : ""
              }`}
            >
              <span className="flex items-center justify-between w-full gap-2">
                <span className="leading-snug">{c}</span>
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                    active ? "border-[var(--k-ink)] bg-[var(--k-ink)] text-white" : "border-[#cdd2cb] text-transparent"
                  }`}
                >
                  <IconCheck className="h-3 w-3" />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </ObShell>
  );
}
