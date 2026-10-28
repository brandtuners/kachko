export interface ShortLink {
  id: string;
  code: string;
  title: string | null;
  channel: string | null;
  tags: string[];
  destinationUrl: string;
  utm: { source?: string; medium?: string; campaign?: string; term?: string; content?: string };
  shortUrl: string;
  isActive: boolean;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShortLinkList {
  items: ShortLink[];
  nextCursor: string | null;
}

export interface ShortLinkStats {
  clicks: number;
  periodDays: number;
  activity: Array<{ date: string; clicks: number }>;
  devices: Array<{ label: string; clicks: number }>;
  sources: Array<{ label: string; clicks: number }>;
  countries: Array<{ label: string; clicks: number }>;
}
