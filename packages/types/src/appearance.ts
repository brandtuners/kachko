import type { ApiData } from './index';
import type { PageBlock, PageThemeKey } from './pages';
export interface ThemeConfig {
  background: { type: 'solid'; color: string } | { type: 'gradient'; from: string; to: string; via?: string; glow?: string; angle: number };
  typography: { fontFamily: 'system' | 'sans' | 'serif' | 'mono'; titleSize: number; color: string };
  buttons: { variant: 'filled' | 'outline' | 'glass'; radius: number; background: string; color: string; shadow: boolean };
  cards: { radius: number; background: string; border?: string; blur: number };
}
export interface AppearanceOverrides {
  background?: ThemeConfig['background']; typography?: Partial<ThemeConfig['typography']>;
  buttons?: Partial<ThemeConfig['buttons']>; cards?: Partial<ThemeConfig['cards']>;
}
export interface SystemTheme { id: string; key: PageThemeKey; name: string; config: ThemeConfig }
export interface PageTemplate {
  key: 'starter' | 'creator' | 'professional'; name: string; description: string; themeKey: PageThemeKey;
  blocks: TemplateBlock[];
}
export type SocialPlatform = 'INSTAGRAM' | 'YOUTUBE' | 'X' | 'LINKEDIN' | 'FACEBOOK' | 'TIKTOK' | 'GITHUB' | 'DISCORD' | 'TWITCH' | 'SPOTIFY';
export interface PublicSocial { id: string; platform: SocialPlatform; username: string | null; url: string }
export interface SocialProfile extends PublicSocial { position: number; isVisible: boolean; createdAt: string; updatedAt: string }
export type ThemeListResponse = ApiData<SystemTheme[]>;
export type TemplateListResponse = ApiData<PageTemplate[]>;
export type SocialResponse = ApiData<SocialProfile>;
export type SocialListResponse = ApiData<SocialProfile[]>;

type TemplateFields<T> = T extends PageBlock ? Pick<T, 'type' | 'content' | 'isVisible'> : never;
// Seed templates currently contain only self-contained blocks. Managed IMAGE
// blocks require media owned by the applying user and cannot be system seeded.
export type TemplateBlock = TemplateFields<Extract<PageBlock, { type: 'LINK' | 'TEXT' }>>;
