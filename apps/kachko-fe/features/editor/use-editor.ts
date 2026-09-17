"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addBlock,
  addSocial,
  deleteBlock,
  deleteSocial,
  ensurePage,
  listThemes,
  reorderBlocks,
  setTheme,
  setAppearanceConfig,
  setBackgroundImage,
  updateBlock,
  updatePageMeta,
  updateSocial,
} from "./api";
import type { BackgroundImageSettings } from "./api";
import type { EditorPage } from "./types";
import type { ThemeConfig } from "@kachko/types";

export const pageKey = ["my-page"] as const;

// Central editor state: loads the owner's single page and exposes optimistic
// mutations for blocks/socials/meta (§8.4 live editing). All network access goes
// through the same-origin client (AD-01).
export function useEditor() {
  const qc = useQueryClient();

  const pageQuery = useQuery({
    queryKey: pageKey,
    queryFn: ensurePage,
  });

  const themesQuery = useQuery({
    queryKey: ["themes"],
    queryFn: listThemes,
  });

  const setPageCache = (updater: (p: EditorPage) => EditorPage) => {
    qc.setQueryData<EditorPage>(pageKey, (prev) => (prev ? updater(prev) : prev));
  };

  const saveMeta = useMutation({
    mutationFn: (data: { title?: string; description?: string; isPublished?: boolean }) =>
      updatePageMeta(data),
    onSuccess: (page) => qc.setQueryData(pageKey, page),
  });

  const createBlock = useMutation({
    mutationFn: (input: { type: string; content: Record<string, unknown> }) => addBlock(input.type, input.content),
    onSuccess: (block) => setPageCache((p) => ({ ...p, blocks: [...p.blocks, block] })),
  });

  const editBlock = useMutation({
    onSettled: () => qc.invalidateQueries({ queryKey: pageKey }),
    mutationFn: (input: { id: string; data: { content?: Record<string, unknown>; isVisible?: boolean; position?: number } }) =>
      updateBlock(input.id, input.data),
    onMutate: ({ id, data }) =>
      setPageCache((p) => ({
        ...p,
        blocks: p.blocks.map((b) => (b.id === id ? { ...b, ...data } : b)),
      })),
  });

  const removeBlock = useMutation({
    mutationFn: (id: string) => deleteBlock(id),
    onSuccess: (_u, id) => setPageCache((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== id) })),
  });

  const moveBlock = useMutation({
    mutationFn: (orderedIds: string[]) => reorderBlocks(orderedIds),
    onSuccess: (blocks) => setPageCache((p) => ({ ...p, blocks: blocks && blocks.length ? blocks : p.blocks })),
    onError: () => {
      void qc.invalidateQueries({ queryKey: pageKey });
    },
  });

  const createSocial = useMutation({
    mutationFn: (input: { platform: string; url: string; username?: string }) =>
      addSocial(input.platform, input.url, input.username),
    onSuccess: (s) => setPageCache((p) => ({ ...p, socials: [...p.socials, s] })),
  });

  const editSocial = useMutation({
    mutationFn: (input: { id: string; data: { url?: string; username?: string; isVisible?: boolean; position?: number } }) =>
      updateSocial(input.id, input.data),
    onSuccess: (s) => setPageCache((p) => ({ ...p, socials: p.socials.map((x) => (x.id === s.id ? s : x)) })),
  });

  const removeSocial = useMutation({
    mutationFn: (id: string) => deleteSocial(id),
    onSuccess: (_u, id) => setPageCache((p) => ({ ...p, socials: p.socials.filter((s) => s.id !== id) })),
  });

  const pickTheme = useMutation({
    mutationFn: (themeId: string) => setTheme(themeId),
    // The PATCH response carries themeId only; merge the full theme row from the
    // themes list so the fixed phone preview restyles instantly.
    onSuccess: (p) =>
      setPageCache((prev) => {
        const theme = p.theme ?? null;
        return { ...prev, ...p, theme };
      }),
  });
  const setBackground = useMutation({
    mutationFn: (settings: BackgroundImageSettings) => setBackgroundImage(settings),
    onSuccess: (page) => qc.setQueryData(pageKey, page),
  });
  const saveAppearance = useMutation({
    mutationFn: (config: ThemeConfig) => setAppearanceConfig(config),
    onSuccess: (page) => qc.setQueryData(pageKey, page),
  });

  return {
    page: pageQuery.data,
    isLoading: pageQuery.isLoading,
    isError: pageQuery.isError,
    error: pageQuery.error,
    refetch: pageQuery.refetch,
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
