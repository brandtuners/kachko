"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addBlock,
  addSocial,
  createMyPage,
  deleteBlock,
  deleteMyPage,
  deleteSocial,
  getMyPage,
  listMyPages,
  listThemes,
  reorderBlocks,
  setTheme,
  setAppearanceConfig,
  setBackgroundImage,
  updateBlock,
  updatePageMeta,
  updateSocial,
} from "./api";
import { usePageSelection } from "./page-selection";
import type { BackgroundImageSettings } from "./api";
import type { EditorPage } from "./types";
import type { PageSummary, ThemeConfig } from "@kachko/types";

export const pagesKey = ["my-pages"] as const;
export const pageKey = (pageId: string) => ["my-page", pageId] as const;
const pageSummary = (page: EditorPage): PageSummary => ({
  id: page.id, slug: page.slug, isPrimary: page.isPrimary, title: page.title,
  description: page.description, themeKey: page.themeKey, isPublished: page.isPublished,
  publishedAt: page.publishedAt, createdAt: page.createdAt, updatedAt: page.updatedAt,
});

// Central editor state: loads the owner's selected page and exposes optimistic
// mutations for blocks/socials/meta (§8.4 live editing). All network access goes
// through the same-origin client (AD-01).
export function useEditor() {
  const qc = useQueryClient();
  const selectedPageId = usePageSelection((state) => state.selectedPageId);
  const selectPage = usePageSelection((state) => state.selectPage);

  const pagesQuery = useQuery({
    queryKey: pagesKey,
    queryFn: listMyPages,
  });
  const pages = pagesQuery.data ?? [];
  const effectivePageId = pages.some((page) => page.id === selectedPageId)
    ? selectedPageId
    : (pages.find((page) => page.isPrimary) ?? pages[0])?.id ?? null;

  useEffect(() => {
    if (effectivePageId && effectivePageId !== selectedPageId) selectPage(effectivePageId);
  }, [effectivePageId, selectPage, selectedPageId]);

  const pageQuery = useQuery({
    queryKey: pageKey(effectivePageId ?? "pending"),
    queryFn: () => getMyPage(effectivePageId!),
    enabled: Boolean(effectivePageId),
  });

  const themesQuery = useQuery({
    queryKey: ["themes"],
    queryFn: listThemes,
  });

  const setPageCache = (updater: (p: EditorPage) => EditorPage) => {
    if (!effectivePageId) return;
    qc.setQueryData<EditorPage>(pageKey(effectivePageId), (prev) => (prev ? updater(prev) : prev));
  };
  const activePageId = () => {
    if (!effectivePageId) throw new Error("Select a page first");
    return effectivePageId;
  };

  const createPage = useMutation({
    mutationFn: async (input: { title?: string; description?: string; slug: string }) => {
      const created = await createMyPage(input);
      return getMyPage(created.id);
    },
    onSuccess: (page) => {
      qc.setQueryData<EditorPage>(pageKey(page.id), page);
      qc.setQueryData<PageSummary[]>(pagesKey, (current = []) => [...current.filter((item) => item.id !== page.id), pageSummary(page)]);
      void qc.invalidateQueries({ queryKey: pagesKey });
      selectPage(page.id);
    },
  });

  const removePage = useMutation({
    mutationFn: (pageId: string) => deleteMyPage(pageId),
    onSuccess: (_result, pageId) => {
      qc.removeQueries({ queryKey: pageKey(pageId) });
      qc.setQueryData<PageSummary[]>(pagesKey, (current = []) => {
        const deleted = current.find((page) => page.id === pageId);
        const remaining = current.filter((page) => page.id !== pageId);
        return deleted?.isPrimary && remaining.length
          ? remaining.map((page, index) => ({ ...page, isPrimary: index === 0 }))
          : remaining;
      });
      selectPage(null);
      void qc.invalidateQueries({ queryKey: pagesKey });
    },
  });

  const saveMeta = useMutation({
    mutationFn: (data: { title?: string; description?: string; isPublished?: boolean }) =>
      updatePageMeta(activePageId(), data),
    onSuccess: (page) => {
      qc.setQueryData(pageKey(page.id), page);
      qc.setQueryData<PageSummary[]>(pagesKey, (current = []) => current.map((item) => item.id === page.id ? pageSummary(page) : item));
    },
  });

  const createBlock = useMutation({
    mutationFn: (input: { type: string; content: Record<string, unknown> }) => addBlock(activePageId(), input.type, input.content),
    onSuccess: (block) => setPageCache((p) => ({ ...p, blocks: [...p.blocks, block] })),
  });

  const editBlock = useMutation({
    onSettled: () => effectivePageId && qc.invalidateQueries({ queryKey: pageKey(effectivePageId) }),
    mutationFn: (input: { id: string; data: { content?: Record<string, unknown>; isVisible?: boolean; position?: number } }) =>
      updateBlock(activePageId(), input.id, input.data),
    onMutate: ({ id, data }) =>
      setPageCache((p) => ({
        ...p,
        blocks: p.blocks.map((b) => (b.id === id ? { ...b, ...data } : b)),
      })),
  });

  const removeBlock = useMutation({
    mutationFn: (id: string) => deleteBlock(activePageId(), id),
    onSuccess: (_u, id) => setPageCache((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== id) })),
  });

  const moveBlock = useMutation({
    mutationFn: (orderedIds: string[]) => reorderBlocks(activePageId(), orderedIds),
    onMutate: async (orderedIds) => {
      if (effectivePageId) await qc.cancelQueries({ queryKey: pageKey(effectivePageId) });
      const previous = effectivePageId ? qc.getQueryData<EditorPage>(pageKey(effectivePageId)) : undefined;
      const positions = new Map(orderedIds.map((id, position) => [id, position]));
      setPageCache((page) => ({
        ...page,
        blocks: [...page.blocks]
          .map((block) => ({ ...block, position: positions.get(block.id) ?? block.position }))
          .sort((a, b) => a.position - b.position),
      }));
      return { previous };
    },
    onSuccess: (blocks) => setPageCache((p) => ({ ...p, blocks: blocks && blocks.length ? blocks : p.blocks })),
    onError: (_error, _orderedIds, context) => {
      if (context?.previous && effectivePageId) qc.setQueryData(pageKey(effectivePageId), context.previous);
    },
    onSettled: () => { if (effectivePageId) void qc.invalidateQueries({ queryKey: pageKey(effectivePageId) }); },
  });

  const createSocial = useMutation({
    mutationFn: (input: { platform: string; url: string; username?: string }) =>
      addSocial(activePageId(), input.platform, input.url, input.username),
    onSuccess: (s) => setPageCache((p) => ({ ...p, socials: [...p.socials, s] })),
  });

  const editSocial = useMutation({
    mutationFn: (input: { id: string; data: { url?: string; username?: string; isVisible?: boolean; position?: number } }) =>
      updateSocial(activePageId(), input.id, input.data),
    onSuccess: (s) => setPageCache((p) => ({ ...p, socials: p.socials.map((x) => (x.id === s.id ? s : x)) })),
  });

  const removeSocial = useMutation({
    mutationFn: (id: string) => deleteSocial(activePageId(), id),
    onSuccess: (_u, id) => setPageCache((p) => ({ ...p, socials: p.socials.filter((s) => s.id !== id) })),
  });

  const pickTheme = useMutation({
    mutationFn: (themeId: string) => setTheme(activePageId(), themeId),
    // The PATCH response carries themeId only; merge the full theme row from the
    // themes list so the fixed phone preview restyles instantly.
    onSuccess: (p) =>
      setPageCache((prev) => {
        const theme = p.theme ?? null;
        return { ...prev, ...p, theme };
      }),
  });
  const setBackground = useMutation({
    mutationFn: (settings: BackgroundImageSettings) => setBackgroundImage(activePageId(), settings),
    onSuccess: (page) => qc.setQueryData(pageKey(page.id), page),
  });
  const saveAppearance = useMutation({
    mutationFn: (config: ThemeConfig) => setAppearanceConfig(activePageId(), config),
    onSuccess: (page) => qc.setQueryData(pageKey(page.id), page),
  });

  return {
    page: pageQuery.data,
    pages,
    selectedPageId: effectivePageId,
    selectPage,
    createPage,
    removePage,
    isLoading: pagesQuery.isLoading || (Boolean(effectivePageId) && pageQuery.isLoading),
    isError: pagesQuery.isError || pageQuery.isError,
    error: pagesQuery.error ?? pageQuery.error,
    refetch: async () => { await pagesQuery.refetch(); return pageQuery.refetch(); },
    themes: themesQuery.data ?? [],
    saveMeta,
    createBlock,
    editBlock,
    removeBlock,
    moveBlock,
    createSocial,
    editSocial,
    removeSocial,
    pickTheme,
    setBackground,
    saveAppearance,
  };
}

export type EditorApi = ReturnType<typeof useEditor>;
