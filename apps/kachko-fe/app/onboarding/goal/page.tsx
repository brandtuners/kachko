"use client";

// Step 06 — goal (reference: "sign up process 06.png").
// "What are you hoping to achieve with your page?" — vertical single-select tiles.
import { useRouter } from "next/navigation";
import { ObShell } from "../../../features/onboarding/ob-shell";
import { useOnboarding, GOALS } from "../../../features/onboarding/store";
import {
  IconChart,
  IconCheck,
  IconChevronDown,
  IconEye,
  IconGlobe,
  IconPin,
  IconRobot,
  IconUsers,
} from "../../../components/icons";

const GOAL_ICONS: Record<string, (p: { className?: string }) => JSX.Element> = {
  "Grow my audience": IconUsers,
  "Drive traffic to my website": IconGlobe,
  "Share my content": IconEye,
  "Sell my products/services": IconChart,
  "Build my personal brand": IconRobot,
  "Connect with my community": IconPin,
  Other: IconCheck,
};

export default function OnboardingGoalStep() {
  const router = useRouter();
  const { goal, set } = useOnboarding();

  const next = () => router.push("/onboarding/theme");
  const skip = () => router.push("/onboarding/theme");

  return (
    <ObShell
      step={6}
      title="What are you hoping to achieve with your page?"
      subtitle="Pick the one that matters most right now."
      onNext={next}
      nextDisabled={!goal}
      onBack={() => router.back()}
      onSkip={skip}
    >
      <div className="grid gap-3">
        {GOALS.map((g) => {
          const active = goal === g;
          const Icon = GOAL_ICONS[g] ?? IconCheck;
          return (
            <button
              key={g}
              type="button"
              aria-pressed={active}
              onClick={() => set("goal", g)}
              className={`ob-tile py-4 text-base ${active ? "ob-tile-active" : ""}`}
            >
              <Icon className="h-5 w-5 shrink-0 text-[#5c615d]" />
              <span className="flex-1">{g}</span>
              <IconChevronDown className={`h-4 w-4 shrink-0 -rotate-90 transition ${active ? "text-[var(--k-ink)]" : "text-[#b3b8b3]"}`} />
            </button>
          );
        })}
      </div>
    </ObShell>
  );
}
