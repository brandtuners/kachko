import type { ThemeConfig } from "@kachko/types";

// Theme application for the public profile page (M5, §6.4). Maps the stored
// Theme JSON (background / typography / buttons / cards) into CSS custom properties
// and an inline background, so picking a theme in the editor visibly restyles the
// page. Bright, mobile-first; falls back to the default neon look when no theme.

export type ThemeJson = {
  config?: ThemeConfig;
  slug?: string;
  name?: string;
  background?: { from?: string; via?: string; to?: string; glow?: string };
  typography?: { font?: string; heading?: string };
  buttons?: { style?: string; radius?: string; glow?: string };
  cards?: { bg?: string; border?: string };
};

export const ACCENT_COLORS: Record<string, string> = {
  electric: "#6c5cff",
  magenta: "#ff3df0",
  cyan: "#22e3ff",
  lime: "#9dff3d",
  sun: "#ffd23d",
  coral: "#ff5e7a",
};

const ELECTRIC = "#6c5cff";
const MAGENTA = "#ff3df0";
const DEFAULT_ACCENT: string = ELECTRIC;

function accentColor(key?: string): string {
  if (!key) return DEFAULT_ACCENT;
  const found = ACCENT_COLORS[key.toLowerCase()];
  return found ?? DEFAULT_ACCENT;
}

function str(v: string | undefined, fallback: string): string {
  return v ?? fallback;
}

// CSS variables consumed by BlockView/SocialRow (see block-view.tsx).
export function themeVars(theme?: ThemeJson | null): Record<string, string> {
  if (theme?.config) {
    const { buttons, cards, typography } = theme.config;
    return { "--page-text": typography.color,
      "--page-font": { system: 'system-ui, sans-serif', sans: 'Arial, sans-serif', serif: 'Georgia, serif', mono: 'monospace' }[typography.fontFamily],
      "--page-title-size": `${typography.titleSize}px`,
      "--button-bg": buttons.variant === 'filled' ? buttons.background : buttons.variant === 'glass' ? cards.background : 'transparent',
      "--button-text": buttons.variant === 'outline' ? typography.color : buttons.color,
      "--button-radius": `${buttons.radius}px`,
      "--button-blur": buttons.variant === 'glass' ? 'blur(12px)' : 'none',
      "--blk-accent": buttons.background, "--blk-accent2": buttons.color,
      "--blk-card-bg": cards.background, "--blk-card-border": cards.border ?? buttons.background,
      "--blk-glow": buttons.shadow ? "0 8px 24px rgba(0,0,0,0.15)" : "none" };
  }
  const a1 = accentColor(theme?.buttons?.glow ?? "electric");
  const vars: Record<string, string> = {
    "--blk-accent": a1,
    "--blk-accent2": str(theme?.background?.glow, MAGENTA),
    "--blk-card-bg": str(theme?.cards?.bg, "rgba(255,255,255,0.04)"),
    "--blk-card-border": str(theme?.cards?.border, "rgba(255,255,255,0.10)"),
    "--blk-glow": `0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px -20px ${a1}99`,
  };
  return vars;
}

// Inline background for the page root element.
export function themeBackground(theme?: ThemeJson | null): string {
  if (theme?.config) {
    const bg = theme.config.background;
    if (bg.type === "solid") return bg.color;
    const gradient = `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.via ? `${bg.via}, ` : ''}${bg.to})`;
    return bg.glow ? `radial-gradient(ellipse 140% 420px at 50% -100px, ${bg.glow}, transparent 85%), ${gradient}` : gradient;
  }
  const from = str(theme?.background?.from, "#07060f");
  const via = str(theme?.background?.via, "#0e0c1d");
  const to = str(theme?.background?.to, "#171331");
  const glow = str(theme?.background?.glow, "rgba(108,92,255,0.30)");
  return [
    `radial-gradient(900px 420px at 15% -10%, ${glow}, transparent 60%)`,
    `radial-gradient(700px 380px at 95% 5%, ${glow}, transparent 60%)`,
    `linear-gradient(160deg, ${from} 0%, ${via} 45%, ${to} 100%)`,
  ].join(", ");
}

/** Shared by catalog thumbnails, editor preview and public blocks. */
export function themeButtonStyle() {
  return { background: 'var(--button-bg, transparent)', color: 'var(--button-text, white)',
    borderColor: 'var(--blk-card-border, var(--blk-accent))', borderRadius: 'var(--button-radius, 16px)',
    boxShadow: 'var(--blk-glow, none)', backdropFilter: 'var(--button-blur, none)' };
}
