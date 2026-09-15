"use client";

// Onboarding wizard state (reference steps 01–08). Client-only for the answers
// that have no server field yet (categories, platform, goal); name / first link /
// page title / theme are persisted to the API as each step completes.
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const CATEGORIES = [
  "Content Creator",
  "Designer",
  "Developer",
  "Digital Marketer",
  "Entrepreneur",
  "Musician",
  "Photographer",
  "Video Creator",
  "Travel Blogger",
  "Fitness Coach",
  "Health & Nutrition",
  "Art & Illustration",
  "Finance & Investing",
  "Educator",
  "Gaming",
  "Other",
] as const;

export const PLATFORMS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "X",
  "LinkedIn",
  "GitHub",
  "Twitch",
  "Discord",
  "Spotify",
  "Website",
] as const;

export const GOALS = [
  "Grow my audience",
  "Drive traffic to my website",
  "Share my content",
  "Sell my products/services",
  "Build my personal brand",
  "Connect with my community",
  "Other",
] as const;

interface OnboardingState {
  firstName: string;
  lastName: string;
  categories: string[];
  platform: string | null;
  firstLink: string;
  pageTitle: string;
  goal: string | null;
  themeId: string | null;
  linkBlockCreated: boolean;
  set: <K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) => void;
  toggleCategory: (c: string) => void;
  reset: () => void;
}

const initial = {
  firstName: "",
  lastName: "",
  categories: [] as string[],
  platform: null as string | null,
  firstLink: "",
  pageTitle: "",
  goal: null as string | null,
  themeId: null as string | null,
  linkBlockCreated: false,
};

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initial,
      set: (key, value) => set({ [key]: value } as Partial<OnboardingState>),
      toggleCategory: (c) =>
        set((s) => {
          const has = s.categories.includes(c);
          if (has) return { categories: s.categories.filter((x) => x !== c) };
          if (s.categories.length >= 3) return s; // "Select up to 3"
          return { categories: [...s.categories, c] };
        }),
      reset: () => set(initial),
    }),
    { name: "kachko-onboarding" },
  ),
);

export const ONBOARDING_ROUTES = [
  "/onboarding",
  "/onboarding/categories",
  "/onboarding/platform",
  "/onboarding/first-link",
  "/onboarding/title",
  "/onboarding/goal",
  "/onboarding/theme",
  "/onboarding/done",
] as const;
