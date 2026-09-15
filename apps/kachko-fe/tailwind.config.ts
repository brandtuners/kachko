import type { Config } from "tailwindcss";

// KACHKO design system — bright, high-energy palette (product requirement:
// "mind-blowing UI, bright colors"). Electric neons over deep ink so the
// brights pop. Tuned for mobile-first.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./packages/ui/**/*.{ts,tsx}",
  ],
  theme: {
    container: { center: true, padding: "1.25rem", screens: { "2xl": "1200px" } },
    extend: {
      colors: {
        // Landing palette (kachko-landing-page.html — Tailwind v4 @theme tokens
        // ported 1:1). The dashboard/auth/onboarding markup reads the --k-* CSS
        // vars, and only block-view uses `magenta`, so re-pointing these names
        // to the light scheme is additive.
        ink: {
          DEFAULT: "#111312",
          900: "#07060f",
          800: "#0e0c1d",
          700: "#171331",
          600: "#221b40",
        },
        ivory: "#f7f5f0",
        "ivory-deep": "#f1eee6",
        cream: "#fcfbf8",
        line: "#e6e3da",
        sage: "#dce5c5",
        "sage-soft": "#eaf0dd",
        // Bright brand neons
        electric: "#6c5cff",
        magenta: "#ff3df0",
        cyan: "#22e3ff",
        lime: { DEFAULT: "#c2dc4c", deep: "#aac935" },
        sun: "#ffd23d",
        coral: "#ff5e7a",
        olive: "#5c6a20",
        // Semantic
        primary: "#6c5cff",
        "primary-foreground": "#ffffff",
        muted: "#737872",
        "muted-foreground": "#8c84b8",
        border: "rgba(255,255,255,0.10)",
        card: "rgba(255,255,255,0.04)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      opacity: {
        // Steps the landing design uses with color/opacity modifiers
        // (Tailwind v4 supports arbitrary step values; v3 needs them declared).
        "12": "0.12",
        "15": "0.15",
        "35": "0.35",
        "45": "0.45",
        "55": "0.55",
        "85": "0.85",
      },
      borderRadius: { xl: "1rem", "2xl": "1.5rem", "3xl": "2rem" },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px -20px rgba(108,92,255,0.55)",
        "glow-magenta": "0 20px 60px -18px rgba(255,61,240,0.6)",
        "glow-cyan": "0 20px 60px -18px rgba(34,227,255,0.55)",
      },
      backgroundImage: {
        "grid-bright":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        "aurora":
          "radial-gradient(60% 60% at 20% 10%, rgba(255,61,240,0.35) 0%, transparent 60%), radial-gradient(50% 50% at 85% 20%, rgba(34,227,255,0.30) 0%, transparent 60%), radial-gradient(60% 60% at 60% 90%, rgba(108,92,255,0.40) 0%, transparent 60%)",
      },
      keyframes: {
        glow: { "0%,100%": { opacity: "0.55", transform: "scale(0.97)" }, "50%": { opacity: "0.92", transform: "scale(1.03)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-14px)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        "gradient-pan": { "0%,100%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" } },
        "pulse-ring": { "0%": { transform: "scale(0.9)", opacity: "0.7" }, "100%": { transform: "scale(1.6)", opacity: "0" } },
        "fade-up": { "0%": { opacity: "0", transform: "translateY(16px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
      },
      animation: {
        glow: "glow 9s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "gradient-pan": "gradient-pan 8s ease infinite",
        "pulse-ring": "pulse-ring 2.4s ease-out infinite",
        "fade-up": "fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both",
        marquee: "marquee 22s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
