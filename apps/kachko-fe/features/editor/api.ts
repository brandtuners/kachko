import type { OwnerPage, PageSummary, IdentityUser, SystemTheme, ThemeConfig } from "@kachko/types";
import { apiFetch, ApiClientError } from "../../lib/api";
import type { EditorBlock, EditorPage, EditorSocial, EditorTheme } from "./types";

// Thin editor API layer over the same-origin client (AD-01). All calls go through
// /api/v1/* and parse the { data } / { error } envelope (§7.1). Reads/writes the
// owner's selected page (§8.3, §8.4).

export const isAuthError = (e: unknown) =>
  e instanceof ApiClientError && e.code === "UNAUTHENTICATED";

const pagePath = (pageId: string) => `/pages/${encodeURIComponent(pageId)}`;

export async function listMyPages(): Promise<PageSummary[]> {
  const pages = await apiFetch<PageSummary[]>("/pages");
  if (pages.length) return pages;
  const page = await apiFetch<OwnerPage>("/pages", { method: "POST", body: JSON.stringify({}) });
  return [page];
}

export function createMyPage(input: { title?: string; description?: string; slug: string }): Promise<OwnerPage> {
  return apiFetch<OwnerPage>("/pages", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteMyPage(pageId: string): Promise<void> {
  await apiFetch<void>(pagePath(pageId), { method: "DELETE" });
}

async function editorPage(page: OwnerPage): Promise<EditorPage> {
  const user = await apiFetch<IdentityUser>("/users/me");
  return { ...page, blocks: page.blocks.map(block => ({ ...block, content: { ...block.content } })), user, themeId: page.themeKey, theme: { id: page.themeKey, slug: page.themeKey, name: page.themeKey, config: page.appearance } };
}

export async function getMyPage(pageId: string): Promise<EditorPage> {
  return editorPage(await apiFetch<OwnerPage>(pagePath(pageId)));
}

/** Onboarding always configures the primary page. */
export async function ensurePage(): Promise<EditorPage> {
  const pages = await listMyPages();
  const primary = pages.find((page) => page.isPrimary) ?? pages[0];
  if (!primary) throw new ApiClientError("PAGE_NOT_FOUND", "Create a page first");
  return getMyPage(primary.id);
}

export async function updatePageMeta(pageId: string, data: {
  title?: string;
  description?: string;
  isPublished?: boolean;
}): Promise<EditorPage> {
  const path = pagePath(pageId);
  const { isPublished, ...metadata } = data;
  if (Object.keys(metadata).length) await apiFetch(path, { method: "PATCH", body: JSON.stringify(metadata) });
  if (isPublished !== undefined) await apiFetch(`${path}/${isPublished ? "publish" : "unpublish"}`, { method: "POST", body: "{}" });
  return editorPage(await apiFetch<OwnerPage>(path));
}

export async function addBlock(pageId: string, type: string, content: Record<string, unknown>): Promise<EditorBlock> {
  return apiFetch<EditorBlock>(`${pagePath(pageId)}/blocks`, {
    method: "POST",
    body: JSON.stringify({ type, content }),
  });
}

export async function updateBlock(
  pageId: string,
  id: string,
  data: { content?: Record<string, unknown>; isVisible?: boolean; position?: number },
): Promise<EditorBlock> {
  return apiFetch<EditorBlock>(`${pagePath(pageId)}/blocks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function reorderBlocks(pageId: string, orderedIds: string[]): Promise<EditorBlock[]> {
  const page = await apiFetch<OwnerPage>(`${pagePath(pageId)}/blocks/reorder`, {
    method: "POST",
    body: JSON.stringify({ items: orderedIds.map((id, position) => ({ id, position })) }),
  });
  return page.blocks.map(block => ({ ...block, content: { ...block.content } }));
}

export async function deleteBlock(pageId: string, id: string): Promise<void> {
  await apiFetch<void>(`${pagePath(pageId)}/blocks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function addSocial(pageId: string, platform: string, url: string, username?: string): Promise<EditorSocial> {
  return apiFetch<EditorSocial>(`${pagePath(pageId)}/socials`, {
    method: "POST",
    body: JSON.stringify({ platform, url, username }),
  });
}

export async function updateSocial(
  pageId: string,
  id: string,
  data: { url?: string; username?: string; isVisible?: boolean; position?: number },
): Promise<EditorSocial> {
  return apiFetch<EditorSocial>(`${pagePath(pageId)}/socials/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteSocial(pageId: string, id: string): Promise<void> {
  await apiFetch<void>(`${pagePath(pageId)}/socials/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listThemes(): Promise<EditorTheme[]> {
  const themes = await apiFetch<SystemTheme[]>("/themes");
  return themes.map((theme) => ({ id: theme.key, slug: theme.key, name: theme.name, config: theme.config }));
}

export async function setTheme(pageId: string, themeKey: string): Promise<EditorPage> {
  return editorPage(await apiFetch<OwnerPage>(`${pagePath(pageId)}/appearance`, {
    method: "PATCH", body: JSON.stringify({ themeKey }),
  }));
}

export async function setAppearanceConfig(pageId: string, config: ThemeConfig): Promise<EditorPage> {
  return editorPage(await apiFetch<OwnerPage>(`${pagePath(pageId)}/appearance`, {
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

export async function setBackgroundImage(pageId: string, settings: BackgroundImageSettings): Promise<EditorPage> {
  const page = await getMyPage(pageId);
  if (!page.theme?.config) throw new ApiClientError("THEME_NOT_FOUND", "Theme configuration is unavailable");
  return setAppearanceConfig(pageId, { ...page.theme.config, background: { ...page.theme.config.background, ...settings } });
}
