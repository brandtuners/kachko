import type { ThemeConfig, AppearanceOverrides, SocialProfile, PublicSocial } from './appearance';
import type { ApiData } from './index';

export const DEFAULT_PAGE_THEME_KEY = 'minimal' as const;
export type PageThemeKey = 'minimal' | 'dark' | 'gradient' | 'professional' | 'elegant' | 'nature' | 'aurora' | 'neon-pop' | 'cyan-pulse' | 'sunset-lime' | 'coral-drift';
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
export interface TextBlockContent { text: string; alignment: 'left' | 'center' | 'right' }
export interface TextBlock extends Omit<LinkBlock, 'type' | 'content'> {
  type: 'TEXT'; content: TextBlockContent;
}
export interface ExtraBlockContents {
  IMAGE: { mediaId: string; url: string; alt: string; href?: string };
  SOCIAL: { platform: import('./appearance').SocialPlatform; username: string };
  DIVIDER: Record<string, never>;
  YOUTUBE: { videoId: string };
  SPOTIFY: { url: string };
  EMAIL: { email: string };
  PHONE: { number: string };
  LOCATION: { query: string };
}
export type ExtraBlock = { [K in keyof ExtraBlockContents]: Omit<LinkBlock, 'type' | 'content'> & { type: K; content: ExtraBlockContents[K] } }[keyof ExtraBlockContents];
export type PageBlock = LinkBlock | TextBlock | ExtraBlock;
type PublicFields<T> = T extends PageBlock ? Pick<T, 'id' | 'type' | 'content'> : never;
export type PublicBlock = PublicFields<PageBlock>;
export interface OwnerPage extends PageSummary { blocks: PageBlock[]; appearance: ThemeConfig; appearanceOverrides: AppearanceOverrides; socials: SocialProfile[] }
export type PageResponse = ApiData<OwnerPage>;
export type PageListResponse = ApiData<PageSummary[]>;
export type LinkBlockResponse = ApiData<LinkBlock>;
export type BlockResponse = ApiData<PageBlock>;
export type ReorderBlocksResponse = PageResponse;
export type DeleteResponse = ApiData<{ deleted: true }>;
/** Explicit public allowlist: no owner ID, email, session data or hidden blocks. */
export interface PublicPage {
  profile: { username: string; displayName: string | null; bio: string | null; avatarUrl: string | null };
  page: { id: string; title: string | null; description: string | null; themeKey: PageThemeKey; appearance: ThemeConfig };
  blocks: PublicBlock[];
  socials: PublicSocial[];
}
export type PublicPageResponse = ApiData<PublicPage>;
export type PageErrorCode = 'PAGE_ALREADY_EXISTS' | 'PAGE_NOT_FOUND' | 'BLOCK_NOT_FOUND'
  | 'THEME_NOT_FOUND' | 'TEMPLATE_NOT_FOUND' | 'SOCIAL_NOT_FOUND' | 'TEMPLATE_REPLACE_REQUIRED' | 'SOCIAL_ORDER_CONFLICT' | 'BLOCK_ORDER_CONFLICT' | 'VALIDATION_ERROR' | 'UNAUTHENTICATED' | 'CSRF_REJECTED' | 'RATE_LIMITED';
