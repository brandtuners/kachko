"use client";

// Step 03 — platform (reference: "sign up process 03.png").
// "Where do you share most?" — single-select tiles with brand glyphs.
import { useRouter } from "next/navigation";
import { ObShell } from "../../../features/onboarding/ob-shell";
import { useOnboarding, PLATFORMS } from "../../../features/onboarding/store";
import { SOCIAL_ICONS, IconGlobe, IconCheck } from "../../../components/icons";

function PlatformIcon({ name, className }: { name: string; className?: string }) {
  if (name === "Website") return <IconGlobe className={className} />;
  const key = name === "X" ? "X" : name.toUpperCase();
  const Cmp = SOCIAL_ICONS[key];
  return Cmp ? <Cmp className={className} /> : <IconGlobe className={className} />;
}

export default function OnboardingPlatformStep() {
  const router = useRouter();
  const { platform, set } = useOnboarding();

  const next = () => router.push("/onboarding/first-link");
  const skip = () => {
    set("platform", null);
    router.push("/onboarding/first-link");
  };

  return (
    <ObShell
      step={3}
      title="Where do you share most?"
      subtitle="Your main platform gets top billing on your page."
      onNext={next}
      nextDisabled={!platform}
      onBack={() => router.back()}
      onSkip={skip}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PLATFORMS.map((p) => {
          const active = platform === p;
          return (
            <button
              key={p}
              type="button"
              aria-pressed={active}
              onClick={() => set("platform", p)}
              className={`ob-tile ${active ? "ob-tile-active" : ""}`}
            >
              <PlatformIcon name={p} className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{p}</span>
              {active ? (
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--k-ink)] text-white">
                  <IconCheck className="h-3 w-3" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </ObShell>
  );
}
