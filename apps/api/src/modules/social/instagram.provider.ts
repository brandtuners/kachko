import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialProviderError } from './social-provider.error';

export const INSTAGRAM_SCOPES = ['instagram_business_basic', 'instagram_business_manage_comments',
  'instagram_business_manage_messages', 'instagram_business_manage_insights'];
export const nullableCount = (value: unknown): number | null => {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || (typeof value === 'string' && !/^\d+$/.test(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};
type GraphResult = { [key: string]: unknown; data?: Array<Record<string, unknown>> };

@Injectable()
export class InstagramProvider {
  constructor(private readonly config: ConfigService) {}
  configured() {
    return ['SOCIAL_INSTAGRAM_CLIENT_ID', 'SOCIAL_INSTAGRAM_CLIENT_SECRET', 'SOCIAL_INSTAGRAM_REDIRECT_URI',
      'SOCIAL_INSTAGRAM_WEBHOOK_VERIFY_TOKEN', 'SOCIAL_TOKEN_ENCRYPTION_KEY'].every(key => Boolean(this.config.get<string>(key)));
  }
  private base() { return `https://graph.instagram.com/${this.config.get<string>('SOCIAL_INSTAGRAM_API_VERSION') ?? 'v25.0'}`; }
  private async request(url: string, options: RequestInit = {}, mutating = false): Promise<GraphResult> {
    try {
      const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10_000) });
      const json = await response.json() as GraphResult & { error?: { code?: number } };
      if (!response.ok || json.error) {
        const code = json.error?.code;
        throw new SocialProviderError(`INSTAGRAM_${code ?? response.status}`, code === 190 || code === 10 || code === 200 || response.status === 401, mutating && response.status >= 500);
      }
      return json;
    } catch (error) {
      if (error instanceof SocialProviderError) throw error;
      throw new SocialProviderError('INSTAGRAM_UNAVAILABLE', false, mutating);
    }
  }
  graph(path: string, token: string, params: Record<string, string> = {}, method = 'GET', body?: unknown) {
    const url = new URL(`${this.base()}/${path}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return this.request(url.href, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }, method !== 'GET');
  }
  authorize(state: string) {
    const url = new URL('https://www.instagram.com/oauth/authorize');
    url.search = new URLSearchParams({ client_id: this.config.getOrThrow<string>('SOCIAL_INSTAGRAM_CLIENT_ID'),
      redirect_uri: this.config.getOrThrow<string>('SOCIAL_INSTAGRAM_REDIRECT_URI'), response_type: 'code',
      scope: INSTAGRAM_SCOPES.join(','), state, enable_fb_login: '0', force_authentication: '1' }).toString();
    return url.href;
  }
  async exchange(code: string) {
    const short = await this.request('https://api.instagram.com/oauth/access_token', { method: 'POST',
      body: new URLSearchParams({ client_id: this.config.getOrThrow<string>('SOCIAL_INSTAGRAM_CLIENT_ID'),
        client_secret: this.config.getOrThrow<string>('SOCIAL_INSTAGRAM_CLIENT_SECRET'),
        redirect_uri: this.config.getOrThrow<string>('SOCIAL_INSTAGRAM_REDIRECT_URI'), grant_type: 'authorization_code', code }) });
    const data = short.data?.[0] ?? short;
    if (typeof data.access_token !== 'string') throw new SocialProviderError('INSTAGRAM_TOKEN_INVALID', true);
    const url = new URL('https://graph.instagram.com/access_token');
    url.search = new URLSearchParams({ grant_type: 'ig_exchange_token',
      client_secret: this.config.getOrThrow<string>('SOCIAL_INSTAGRAM_CLIENT_SECRET'), access_token: data.access_token }).toString();
    const long = await this.request(url.href);
    if (typeof long.access_token !== 'string') throw new SocialProviderError('INSTAGRAM_TOKEN_INVALID', true);
    const scopes = typeof data.permissions === 'string' ? data.permissions.split(',')
      : Array.isArray(data.permissions) ? data.permissions.filter((item): item is string => typeof item === 'string') : [];
    return { accessToken: long.access_token, expiresAt: new Date(Date.now() + Number(long.expires_in ?? 3600) * 1000), scopes };
  }
  async refresh(accessToken: string) {
    const url = new URL('https://graph.instagram.com/refresh_access_token');
    url.search = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: accessToken }).toString();
    const data = await this.request(url.href);
    if (typeof data.access_token !== 'string') throw new SocialProviderError('INSTAGRAM_TOKEN_INVALID', true);
    // Refresh renews a grant; it does not grant previously declined scopes.
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + Number(data.expires_in ?? 3600) * 1000), scopes: [] as string[] };
  }
  async profile(token: string) {
    const data = await this.graph('me', token, { fields: 'id,user_id,username,profile_picture_url,followers_count,media_count' });
    const externalId = String(data.user_id ?? data.id ?? '');
    if (!/^\d+$/.test(externalId) || typeof data.username !== 'string') throw new SocialProviderError('INSTAGRAM_PROFILE_INVALID');
    return { externalId, username: data.username, avatarUrl: typeof data.profile_picture_url === 'string' ? data.profile_picture_url : null,
      followers: nullableCount(data.followers_count), posts: nullableCount(data.media_count), views: null };
  }
  async subscribe(externalId: string, token: string) {
    await this.graph(`${externalId}/subscribed_apps`, token, { subscribed_fields: 'comments,messages' }, 'POST');
  }
  async revoke(token: string) { await this.graph('me/permissions', token, {}, 'DELETE'); }
  async media(externalId: string, token: string) {
    const data = await this.graph(`${externalId}/media`, token, { fields: 'id,caption,media_type,permalink,timestamp,like_count,comments_count', limit: '50' });
    return (data.data ?? []).map(item => ({ externalId: String(item.id), caption: typeof item.caption === 'string' ? item.caption : null,
      permalink: typeof item.permalink === 'string' ? item.permalink : null, mediaType: String(item.media_type),
      publishedAt: new Date(String(item.timestamp)), likes: nullableCount(item.like_count), comments: nullableCount(item.comments_count), views: null as number | null }));
  }
  async collect(externalId: string, token: string) {
    const until = Math.floor(Date.now() / 1000);
    const since = until - 30 * 86_400;
    const [profile, media, totals, series] = await Promise.all([
      this.profile(token), this.media(externalId, token),
      this.graph(`${externalId}/insights`, token, { metric: 'views,reach', period: 'day', metric_type: 'total_value', since: String(since), until: String(until) }),
      this.graph(`${externalId}/insights`, token, { metric: 'reach', period: 'day', metric_type: 'time_series', since: String(since), until: String(until) }),
    ]);
    const total = (name: string) => nullableCount((totals.data?.find(item => item.name === name)?.total_value as { value?: unknown } | undefined)?.value);
    const values = series.data?.find(item => item.name === 'reach')?.values as Array<{ end_time: string; value: unknown }> | undefined;
    const history = (values ?? []).map(item => ({ date: new Date(new Date(item.end_time).getTime() - 86_400_000).toISOString().slice(0, 10),
      views: null, reach: nullableCount(item.value) }));
    // Insights are lifetime values per media; avoid confusing missing data with zero.
    for (const item of media.slice(0, 10)) {
      try {
        const insights = await this.graph(`${item.externalId}/insights`, token, { metric: 'views' });
        const metric = insights.data?.find(value => value.name === 'views');
        const points = metric?.values as Array<{ value?: unknown }> | undefined;
        item.views = nullableCount(points?.[0]?.value ?? (metric?.total_value as { value?: unknown } | undefined)?.value);
      } catch (error) { if (error instanceof SocialProviderError && error.reconnect) throw error; }
    }
    const demographics = { countries: await this.demographics(externalId, token, 'country'),
      cities: await this.demographics(externalId, token, 'city'), genders: await this.demographics(externalId, token, 'gender') };
    return { profile, media, history, totals: { views: total('views'), reach: total('reach'), demographics } };
  }
  private async demographics(externalId: string, token: string, breakdown: string) {
    try {
      const result = await this.graph(`${externalId}/insights`, token, { metric: 'follower_demographics',
        period: 'lifetime', metric_type: 'total_value', timeframe: 'this_month', breakdown });
      const metric = result.data?.[0]?.total_value as { breakdowns?: Array<{ results?: Array<{ dimension_values?: string[]; value?: number }> }> } | undefined;
      const rows = metric?.breakdowns?.[0]?.results;
      return rows?.map(row => ({ label: row.dimension_values?.join(', ') ?? 'Unknown', value: nullableCount(row.value) }))
        .filter((row): row is { label: string; value: number } => row.value !== null).sort((a, b) => b.value - a.value).slice(0, 10) ?? null;
    } catch (error) {
      if (error instanceof SocialProviderError && error.reconnect) throw error;
      return null;
    }
  }
  async comment(commentId: string, token: string) {
    return this.graph(commentId, token, { fields: 'id,text,timestamp,from' });
  }
  async sendPrivateReply(externalId: string, token: string, commentId: string, message: string, label: string, url: string) {
    // Meta documents text for comment-triggered private replies. Include a named
    // clickable URL in that single message; do not spend the one-reply allowance
    // on an unsupported template or a second send.
    const result = await this.graph(`${externalId}/messages`, token, {}, 'POST', {
      recipient: { comment_id: commentId }, message: { text: `${message}\n\n${label}: ${url}` },
    });
    if (typeof result.message_id !== 'string') throw new SocialProviderError('INSTAGRAM_SEND_UNCONFIRMED', false, true);
    return result.message_id;
  }
  async replyPublic(commentId: string, token: string, message: string) {
    await this.graph(`${commentId}/replies`, token, {}, 'POST', { message });
  }
}
