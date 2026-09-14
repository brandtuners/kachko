import type { ApiData } from './index';

export const DEFAULT_PAGE_THEME_KEY = 'minimal' as const;
export type PageThemeKey = typeof DEFAULT_PAGE_THEME_KEY;
export interface LinkBlockContent {
  title: string;
  url: string;
  openInNewTab: boolean;
}
export interface LinkBlock {
  id: string;
  type: 'LINK';
  position: number;
  isVisible: boolean;
  content: LinkBlockContent;
  createdAt: string;
  updatedAt: string;
}
export interface PageSummary {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  themeKey: PageThemeKey;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface OwnerPage extends PageSummary { blocks: LinkBlock[] }
export type PageResponse = ApiData<OwnerPage>;
export type PageListResponse = ApiData<PageSummary[]>;
export type LinkBlockResponse = ApiData<LinkBlock>;
export type DeleteResponse = ApiData<{ deleted: true }>;
/** Explicit public allowlist: no owner ID, email, session data or hidden blocks. */
export interface PublicPage {
  profile: { username: string; displayName: string | null; bio: string | null; avatarUrl: string | null };
  page: { title: string | null; description: string | null; themeKey: PageThemeKey };
  blocks: { id: string; type: 'LINK'; content: LinkBlockContent }[];
}
export type PublicPageResponse = ApiData<PublicPage>;
export type PageErrorCode = 'PAGE_ALREADY_EXISTS' | 'PAGE_NOT_FOUND' | 'BLOCK_NOT_FOUND'
  | 'VALIDATION_ERROR' | 'UNAUTHENTICATED' | 'CSRF_REJECTED' | 'RATE_LIMITED';
