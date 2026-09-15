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
  | "LOCATION";

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
  title: string | null;
  description: string | null;
  isPublished: boolean;
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
};

export const BLOCK_TYPES: BlockType[] = ["LINK", "TEXT", "IMAGE", "SOCIAL", "DIVIDER", "YOUTUBE", "SPOTIFY", "EMAIL", "PHONE", "LOCATION"];

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
