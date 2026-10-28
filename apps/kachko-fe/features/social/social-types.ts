export interface ConnectedSocialAccount {
  id: string;
  platform: "INSTAGRAM" | "YOUTUBE";
  username: string;
  avatarUrl: string | null;
  tokenExpiresAt: string | null;
  lastSyncedAt: string | null;
  status: "CONNECTED" | "RECONNECT_REQUIRED";
}

export interface SocialMediaItem {
  id: string;
  caption: string | null;
  permalink: string | null;
  mediaType: string;
  publishedAt: string;
  likes: number | null;
  comments: number | null;
  views: number | null;
}

export interface SocialAccountAnalytics {
  followers: number | null;
  followersChange: number | null;
  posts: number | null;
  views: number | null;
  reach: number | null;
  demographics?: {
    countries: Array<{ label: string; value: number }> | null;
    cities: Array<{ label: string; value: number }> | null;
    genders: Array<{ label: string; value: number }> | null;
  } | null;
  history: Array<{ date: string; followers: number | null; views: number | null; reach: number | null }>;
  media: SocialMediaItem[];
  lastSyncedAt: string | null;
}

export interface InstagramAutomation {
  id: string;
  accountId: string;
  name: string;
  triggerType: "SPECIFIC_POST" | "ALL_POSTS" | "NEXT_POST";
  mediaId: string | null;
  matchType: "ANY" | "KEYWORDS";
  keywords: string[];
  message: string;
  buttonLabel: string;
  destinationUrl: string;
  publicReply: string | null;
  isActive: boolean;
  sends: number;
  clicks: number;
  failed: number;
  createdAt: string;
}

export function socialNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : value.toLocaleString();
}

export function socialDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "Not synced yet";
}
