"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type PageSelection = { selectedPageId: string | null; selectPage: (pageId: string | null) => void };

export const usePageSelection = create<PageSelection>()(persist(
  (set) => ({ selectedPageId: null, selectPage: (selectedPageId) => set({ selectedPageId }) }),
  { name: "kachko-selected-page" },
));
