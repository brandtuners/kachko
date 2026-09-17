import type { OwnerPage, PageSummary, IdentityUser, SystemTheme, ThemeConfig } from "@kachko/types";
import { apiFetch, ApiClientError } from "../../lib/api";
import type { EditorBlock, EditorPage, EditorSocial, EditorTheme } from "./types";

// Thin editor API layer over the same-origin client (AD-01). All calls go through
// /api/v1/* and parse the { data } / { error } envelope (§7.1). Reads/writes the
// owner's single page (§8.3, §8.4).

export const isAuthError = (e: unknown) =>
  e instanceof ApiClientError && e.code === "UNAUTHENTICATED";

async function pagePath(): Promise<string> {
  const pages = await apiFetch<PageSummary[]>("/pages");
  if (!pages[0]) throw new ApiClientError("PAGE_NOT_FOUND", "Create a page first");
  return `/pages/${encodeURIComponent(pages[0].id)}`;
}

async function editorPage(page: OwnerPage): Promise<EditorPage> {
  const user = await apiFetch<IdentityUser>("/users/me");
  return { ...page, blocks: page.blocks.map(block => ({ ...block, content: { ...block.content } })), user, themeId: page.themeKey, theme: { id: page.themeKey, slug: page.themeKey, name: page.themeKey, config: page.appearance } };
}

export async function getMyPage(): Promise<EditorPage> {
  return editorPage(await apiFetch<OwnerPage>(await pagePath()));
}

export async function ensurePage(): Promise<EditorPage> {
  try {
    return await getMyPage();
  } catch (e) {
    if (e instanceof ApiClientError && e.code === "PAGE_NOT_FOUND") {
      try {
        return await editorPage(await apiFetch<OwnerPage>("/pages", { method: "POST", body: JSON.stringify({}) }));
      } catch (creationError) {
        if (creationError instanceof ApiClientError && creationError.code === "PAGE_ALREADY_EXISTS") return getMyPage();
        throw creationError;
      }
    }
    throw e;
  }
}

export async function updatePageMeta(data: {
  title?: string;
  description?: string;
  isPublished?: boolean;
}): Promise<EditorPage> {
  const path = await pagePath();
  const { isPublished, ...metadata } = data;
  if (Object.keys(metadata).length) await apiFetch(path, { method: "PATCH", body: JSON.stringify(metadata) });
  if (isPublished !== undefined) await apiFetch(`${path}/${isPublished ? "publish" : "unpublish"}`, { method: "POST", body: "{}" });
  return editorPage(await apiFetch<OwnerPage>(path));
}

export async function addBlock(type: string, content: Record<string, unknown>): Promise<EditorBlock> {
  return apiFetch<EditorBlock>(`${await pagePath()}/blocks`, {
    method: "POST",
    body: JSON.stringify({ type, content }),
  });
}

export async function updateBlock(
  id: string,
  data: { content?: Record<string, unknown>; isVisible?: boolean; position?: number },
): Promise<EditorBlock> {
  return apiFetch<EditorBlock>(`${await pagePath()}/blocks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function reorderBlocks(orderedIds: string[]): Promise<EditorBlock[]> {
  const page = await apiFetch<OwnerPage>(`${await pagePath()}/blocks/reorder`, {
    method: "POST",
    body: JSON.stringify({ items: orderedIds.map((id, position) => ({ id, position })) }),
  });
  return page.blocks.map(block => ({ ...block, content: { ...block.content } }));
}

export async function deleteBlock(id: string): Promise<void> {
  await apiFetch<void>(`${await pagePath()}/blocks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function addSocial(platform: string, url: string, username?: string): Promise<EditorSocial> {
  return apiFetch<EditorSocial>(`${await pagePath()}/socials`, {
    method: "POST",
    body: JSON.stringify({ platform, url, username }),
  });
}

export async function updateSocial(
  id: string,
  data: { url?: string; username?: string; isVisible?: boolean; position?: number },
): Promise<EditorSocial> {
  return apiFetch<EditorSocial>(`${await pagePath()}/socials/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteSocial(id: string): Promise<void> {
  await apiFetch<void>(`${await pagePath()}/socials/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listThemes(): Promise<EditorTheme[]> {
  const themes = await apiFetch<SystemTheme[]>("/themes");
  return themes.map((theme) => ({ id: theme.key, slug: theme.key, name: theme.name, config: theme.config }));
}

export async function setTheme(themeKey: string): Promise<EditorPage> {
  return editorPage(await apiFetch<OwnerPage>(`${await pagePath()}/appearance`, {
    method: "PATCH", body: JSON.stringify({ themeKey }),
  }));
}

export async function setAppearanceConfig(config: ThemeConfig): Promise<EditorPage> {
  return editorPage(await apiFetch<OwnerPage>(`${await pagePath()}/appearance`, {
    method: "PATCH",
    body: JSON.stringify({ overrides: config }),
  }));
}

export type BackgroundImageSettings = {
  imageMediaId: string;
  imageOpacity: number;
  imageFit: 'cover' | 'contain';
  imagePositionX: number;
  imagePositionY: number;
};

export async function setBackgroundImage(settings: BackgroundImageSettings): Promise<EditorPage> {
  const page = await getMyPage();
  if (!page.theme?.config) throw new ApiClientError("THEME_NOT_FOUND", "Theme configuration is unavailable");
  return setAppearanceConfig({ ...page.theme.config, background: { ...page.theme.config.background, ...settings } });
}
