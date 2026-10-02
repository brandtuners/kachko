import type { ThemeConfig } from "@kachko/types";
// Editor-side types mirroring the API envelope (§7.1, §8.4). Kept local so the
// client bundle does not depend on server-only validation internals.
export type BlockType =
  | "LINK"
  | "TEXT"
  | "IMAGE"
  | "SOCIAL"
  | "DIVIDER"
  | "YOUTUBE"
  | "SPOTIFY"
  | "EMAIL"
  | "PHONE"
  | "LOCATION"
  | "WHATSAPP"
  | "FORM"
  | "SUBSCRIBE";

export type BlockCategory = "CONTENT" | "CONVERSION" | "DYNAMIC";
export type BlockIntent = "VISIT" | "CONTACT" | "SUBSCRIBE" | "WATCH" | "FOLLOW";

export interface BlockDefinition {
  type: BlockType;
  category: BlockCategory;
  intent: BlockIntent;
  editorKey: string;
  rendererKey: string;
  analyticsEvents: string[];
  supportsVisibilityRules: boolean;
}

export interface EditorBlock {
  id: string;
  type: BlockType;
  position: number;
  isVisible: boolean;
  content: Record<string, unknown>;
}

export interface EditorSocial {
  id: string;
  platform: string;
  url: string;
  username: string | null;
  position: number;
  isVisible: boolean;
}

export interface EditorTheme {
  config?: ThemeConfig;
  id: string;
  name: string;
  slug: string;
  // Theme JSON columns — used by the Appearance swatches for a color preview.
  background?: { from?: string; via?: string; to?: string; glow?: string };
  typography?: { font?: string; heading?: string };
  buttons?: { style?: string; radius?: string; glow?: string };
  cards?: { bg?: string; border?: string };
}

export interface EditorUser {
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
}

export interface EditorPage {
  id: string;
  slug: string;
  isPrimary: boolean;
  title: string | null;
  description: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  themeKey: import("@kachko/types").PageThemeKey;
  createdAt: string;
  updatedAt: string;
  themeId: string | null;
  // Full theme row (background/typography/buttons/cards JSON) — the API expands
  // it on /pages/me so the dashboard's live preview matches the public page.
  theme?: EditorTheme | null;
  user: EditorUser;
  blocks: EditorBlock[];
  socials: EditorSocial[];
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  LINK: "Link",
  TEXT: "Text",
  IMAGE: "Image",
  SOCIAL: "Social",
  DIVIDER: "Divider",
  YOUTUBE: "YouTube",
  SPOTIFY: "Spotify",
  EMAIL: "Email",
  PHONE: "Phone",
  LOCATION: "Location",
  WHATSAPP: "WhatsApp",
  FORM: "Contact form",
  SUBSCRIBE: "Email signup",
};

export const BLOCK_TYPES: BlockType[] = ["LINK", "TEXT", "IMAGE", "SOCIAL", "DIVIDER", "YOUTUBE", "SPOTIFY", "EMAIL", "PHONE", "LOCATION", "WHATSAPP", "FORM", "SUBSCRIBE"];

const definition = (type: BlockType, category: BlockCategory, intent: BlockIntent, analyticsEvents: string[] = []): BlockDefinition => ({
  type, category, intent, editorKey: type, rendererKey: type, analyticsEvents, supportsVisibilityRules: false,
});

export const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  LINK: definition("LINK", "CONTENT", "VISIT", ["LINK_CLICK"]),
  TEXT: definition("TEXT", "CONTENT", "VISIT"),
  IMAGE: definition("IMAGE", "CONTENT", "VISIT"),
  SOCIAL: definition("SOCIAL", "CONTENT", "FOLLOW", ["SOCIAL_CLICK"]),
  DIVIDER: definition("DIVIDER", "CONTENT", "VISIT"),
  YOUTUBE: definition("YOUTUBE", "DYNAMIC", "WATCH", ["LINK_CLICK"]),
  SPOTIFY: definition("SPOTIFY", "DYNAMIC", "WATCH", ["LINK_CLICK"]),
  EMAIL: definition("EMAIL", "CONVERSION", "CONTACT", ["LINK_CLICK"]),
  PHONE: definition("PHONE", "CONVERSION", "CONTACT", ["LINK_CLICK"]),
  LOCATION: definition("LOCATION", "CONTENT", "VISIT", ["LINK_CLICK"]),
  WHATSAPP: definition("WHATSAPP", "CONVERSION", "CONTACT", ["WHATSAPP_CLICK"]),
  FORM: definition("FORM", "CONVERSION", "CONTACT", ["FORM_VIEW", "FORM_SUBMIT", "LEAD_CREATED"]),
  SUBSCRIBE: definition("SUBSCRIBE", "CONVERSION", "SUBSCRIBE", ["FORM_VIEW", "SUBSCRIBE", "LEAD_CREATED"]),
};

export const SOCIAL_PLATFORMS = [
  "INSTAGRAM",
  "YOUTUBE",
  "X",
  "LINKEDIN",
  "FACEBOOK",
  "TIKTOK",
  "GITHUB",
  "DISCORD",
  "TWITCH",
  "SPOTIFY",
] as const;
