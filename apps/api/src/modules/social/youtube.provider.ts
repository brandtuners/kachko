import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, CodeChallengeMethod, type Credentials } from 'google-auth-library';
import { SocialProviderError } from './social-provider.error';

export interface YoutubeTokenBundle {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date | null;
  scopes: string[];
}
export interface YoutubeProfile {
  externalId: string;
  username: string;
  avatarUrl: string | null;
  followers: number | null;
  posts: number | null;
  views: number | null;
}
interface Channel {
  id?: string;
  snippet?: { title?: string; customUrl?: string; thumbnails?: Record<string, { url?: string }> };
  statistics?: { viewCount?: string; subscriberCount?: string; hiddenSubscriberCount?: boolean; videoCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}
interface Video {
  id?: string;
  snippet?: { title?: string; publishedAt?: string; channelId?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}
const scopes = ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly'];
const number = (value: unknown): number | null => {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || (typeof value === 'string' && !/^\d+$/.test(value))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};

/** Uses only the connected channel's official read-only Data and Analytics APIs. */
@Injectable()
export class YoutubeProvider {
  constructor(private readonly config: ConfigService) {}

  configured() {
    return Boolean(this.config.get<string>('SOCIAL_YOUTUBE_CLIENT_ID') && this.config.get<string>('SOCIAL_YOUTUBE_CLIENT_SECRET')
      && this.config.get<string>('SOCIAL_YOUTUBE_REDIRECT_URI'));
  }
  private client() {
    if (!this.configured()) throw new SocialProviderError('YOUTUBE_NOT_CONFIGURED');
    return new OAuth2Client({ clientId: this.config.get<string>('SOCIAL_YOUTUBE_CLIENT_ID'),
      clientSecret: this.config.get<string>('SOCIAL_YOUTUBE_CLIENT_SECRET'), redirectUri: this.config.get<string>('SOCIAL_YOUTUBE_REDIRECT_URI'),
      transporterOptions: { timeout: 10_000, retry: false } });
  }
  authorize(state: string, verifier?: string) {
    return this.client().generateAuthUrl({ scope: scopes, state, access_type: 'offline', prompt: 'consent',
      include_granted_scopes: true, ...(verifier ? { code_challenge: createHash('sha256').update(verifier).digest('base64url'),
        code_challenge_method: CodeChallengeMethod.S256 } : {}) });
  }
  private tokenBundle(tokens: Credentials): YoutubeTokenBundle {
    if (!tokens.access_token) throw new SocialProviderError('YOUTUBE_AUTH_FAILED', true);
    return { accessToken: tokens.access_token, ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null, scopes: tokens.scope?.split(/\s+/).filter(Boolean) ?? [] };
  }
  async exchange(code: string, verifier?: string): Promise<YoutubeTokenBundle> {
    const client = this.client();
    try {
      const { tokens } = await client.getToken({ code, ...(verifier ? { codeVerifier: verifier } : {}) });
      return this.tokenBundle(tokens);
    } catch { throw new SocialProviderError('YOUTUBE_AUTH_FAILED', true); }
  }
  async refresh(_accessToken: string, refreshToken?: string): Promise<YoutubeTokenBundle> {
    if (!refreshToken) throw new SocialProviderError('YOUTUBE_RECONNECT_REQUIRED', true);
    // A distinct client prevents concurrent refreshes for different users from sharing credentials.
    const client = this.client();
    client.setCredentials({ refresh_token: refreshToken });
    try {
      const { credentials } = await client.refreshAccessToken();
      return { ...this.tokenBundle(credentials), refreshToken: credentials.refresh_token ?? refreshToken };
    } catch { throw new SocialProviderError('YOUTUBE_RECONNECT_REQUIRED', true); }
  }
  private async get<T>(endpoint: string, token: string, params: Record<string, string>): Promise<T> {
    const url = new URL(endpoint);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    let response: Response;
    try { response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000), redirect: 'error' }); }
    catch { throw new SocialProviderError('YOUTUBE_UNAVAILABLE'); }
    const body = await response.json().catch(() => null) as { error?: { errors?: Array<{ reason?: string }> } } | null;
    if (!response.ok) {
      if (response.status === 401) throw new SocialProviderError('YOUTUBE_RECONNECT_REQUIRED', true);
      const reason = body?.error?.errors?.[0]?.reason;
      if (response.status === 429 || reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || reason === 'rateLimitExceeded') {
        throw new SocialProviderError('YOUTUBE_RATE_LIMITED');
      }
      if (response.status === 403) throw new SocialProviderError('YOUTUBE_PERMISSIONS_REQUIRED', true);
      throw new SocialProviderError('YOUTUBE_UNAVAILABLE');
    }
    if (!body || typeof body !== 'object') throw new SocialProviderError('YOUTUBE_INVALID_RESPONSE');
    return body as T;
  }
  private async channel(token: string, externalId?: string): Promise<Channel & { id: string }> {
    const data = await this.get<{ items?: Channel[] }>('https://www.googleapis.com/youtube/v3/channels', token,
      { part: 'snippet,statistics,contentDetails', mine: 'true', maxResults: '50' });
    const channel = externalId ? data.items?.find(item => item.id === externalId) : data.items?.[0];
    if (!channel?.id) throw new SocialProviderError(externalId ? 'YOUTUBE_CHANNEL_MISMATCH' : 'YOUTUBE_CHANNEL_NOT_FOUND', Boolean(externalId));
    return channel as Channel & { id: string };
  }
  private profileFrom(channel: Channel & { id: string }): YoutubeProfile {
    return { externalId: channel.id, username: channel.snippet?.customUrl ?? channel.snippet?.title ?? channel.id,
      avatarUrl: channel.snippet?.thumbnails?.high?.url ?? channel.snippet?.thumbnails?.default?.url ?? null,
      followers: channel.statistics?.hiddenSubscriberCount ? null : number(channel.statistics?.subscriberCount),
      posts: number(channel.statistics?.videoCount), views: number(channel.statistics?.viewCount) };
  }
  async profile(token: string): Promise<YoutubeProfile> { return this.profileFrom(await this.channel(token)); }

  async collect(externalId: string, token: string) {
    const channel = await this.channel(token, externalId);
    const end = new Date(); end.setUTCDate(end.getUTCDate() - 1);
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - 29);
    const report = await this.get<{ columnHeaders?: Array<{ name?: string }>; rows?: unknown[][] }>(
      'https://youtubeanalytics.googleapis.com/v2/reports', token, { ids: `channel==${externalId}`, startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10), dimensions: 'day', metrics: 'views', sort: 'day' });
    const dayIndex = report.columnHeaders?.findIndex(header => header.name === 'day') ?? -1;
    const viewsIndex = report.columnHeaders?.findIndex(header => header.name === 'views') ?? -1;
    const history: Array<{ date: string; views: number | null; reach: number | null }> = [];
    if (dayIndex >= 0 && viewsIndex >= 0) {
      for (const row of report.rows ?? []) {
        const date = row[dayIndex];
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) history.push({ date, views: number(row[viewsIndex]), reach: null });
      }
    }
    const playlistId = channel.contentDetails?.relatedPlaylists?.uploads;
    const media: Array<{ externalId: string; caption: string | null; permalink: string | null; mediaType: string;
      publishedAt: Date; likes: number | null; comments: number | null; views: number | null }> = [];
    if (playlistId) {
      const uploads = await this.get<{ items?: Array<{ contentDetails?: { videoId?: string } }> }>(
        'https://www.googleapis.com/youtube/v3/playlistItems', token, { part: 'contentDetails', playlistId, maxResults: '50' });
      const ids = (uploads.items ?? []).map(item => item.contentDetails?.videoId).filter((id): id is string => Boolean(id));
      if (ids.length) {
        const videos = await this.get<{ items?: Video[] }>('https://www.googleapis.com/youtube/v3/videos', token,
          { part: 'snippet,statistics', id: ids.join(',') });
        for (const video of videos.items ?? []) {
          const publishedAt = new Date(video.snippet?.publishedAt ?? '');
          if (!video.id || !Number.isFinite(publishedAt.getTime()) || video.snippet?.channelId !== externalId) continue;
          media.push({ externalId: video.id, caption: video.snippet?.title ?? null,
            permalink: `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`, mediaType: 'VIDEO', publishedAt,
            likes: number(video.statistics?.likeCount), comments: number(video.statistics?.commentCount), views: number(video.statistics?.viewCount) });
        }
      }
    }
    const reportedViews = history.map(point => point.views).filter((value): value is number => value !== null);
    return { profile: this.profileFrom(channel), history, media,
      totals: { views: reportedViews.length ? reportedViews.reduce((total, value) => total + value, 0) : null, reach: null } };
  }
  async revoke(token: string): Promise<void> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST',
        body: new URLSearchParams({ token }), signal: AbortSignal.timeout(10_000), redirect: 'error' });
      // invalid_token means the grant was already revoked; local disconnect can proceed.
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        if (response.status !== 400 || body?.error !== 'invalid_token') throw new SocialProviderError('YOUTUBE_REVOKE_FAILED');
      }
    } catch (error) {
      if (error instanceof SocialProviderError) throw error;
      throw new SocialProviderError('YOUTUBE_REVOKE_FAILED');
    }
  }
}
