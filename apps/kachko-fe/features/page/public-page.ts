import { notFound } from "next/navigation";
import type { ThemeConfig, PublicPage as ApiPublicPage } from "@kachko/types";
import { ApiClientError, serverApiFetch } from "../../lib/api";

// Public page fetch (§9 RSC). Runs on the server; in production the API is
// same-origin and Redis-cached. Falls back to 404 for unpublished/unknown slugs.
export interface PublicBlock {
  id: string;
  type: string;
  position: number;
  isVisible: boolean;
  content: Record<string, unknown>;
}
export interface PublicSocial {
  id: string;
  platform: string;
  url: string;
  username: string | null;
  isVisible: boolean;
}
export interface PublicTheme {
  config?: ThemeConfig;
  id: string;
  name: string;
  slug: string;
  background?: unknown;
  typography?: unknown;
  buttons?: unknown;
  cards?: unknown;
}

export interface PublicPage {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  themeId: string | null;
  theme: PublicTheme | null;
  user: { displayName: string | null; username: string; avatarUrl: string | null };
  blocks: PublicBlock[];
  socials: PublicSocial[];
}

export async function getPublicPage(slug: string): Promise<PublicPage | null> {
  try {
    const result = await serverApiFetch<ApiPublicPage>(`/public/${encodeURIComponent(slug)}`);
    return { slug: result.profile.username, ...result.page, themeId: result.page.themeKey,
      // The public renderer reads theme tokens from the theme object itself.
      // Keep `config` for consumers that prefer the grouped shape, while also
      // exposing the API appearance fields at the renderer level.
      theme: { id: result.page.themeKey, slug: result.page.themeKey, name: result.page.themeKey, ...result.page.appearance, config: result.page.appearance }, user: result.profile,
      blocks: result.blocks.map((block, position) => ({ ...block, content: { ...block.content }, position, isVisible: true })),
      socials: result.socials.map((social) => ({ ...social, isVisible: true })) };
  } catch (error) {
    if (error instanceof ApiClientError && error.code === "PAGE_NOT_FOUND") return null;
    throw error;
  }
}

// Helper used by the route to surface 404s.
export async function loadPublicPage(slug: string): Promise<PublicPage> {
  const page = await getPublicPage(slug);
  if (!page) notFound();
  return page;
}
