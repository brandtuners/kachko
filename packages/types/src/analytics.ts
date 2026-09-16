import type { ApiData } from './index';

export type AnalyticsEventType = 'PAGE_VIEW' | 'LINK_CLICK' | 'SOCIAL_CLICK';
export type AnalyticsRange = 'today' | '7d' | '30d';
export interface AnalyticsPeriod { range: AnalyticsRange; from: string; to: string }
export interface AnalyticsSummary extends AnalyticsPeriod {
  totalViews: number;
  uniqueVisitors: number;
  linkClicks: number;
  socialClicks: number;
  clickThroughRate: number;
}
export interface AnalyticsSeriesPoint { date: string; views: number; linkClicks: number; socialClicks: number }
export interface AnalyticsTopLink { blockId: string; title: string; clicks: number }
export interface AnalyticsReferrer { referrer: string; visits: number }
export interface AnalyticsGeo { country: string; city: string | null; visits: number }
export interface AnalyticsDevice { device: string; visits: number }
export type AnalyticsAcceptedResponse = ApiData<{ accepted: true }>;
export type AnalyticsSummaryResponse = ApiData<AnalyticsSummary>;
export type AnalyticsTimeseriesResponse = ApiData<AnalyticsPeriod & { items: AnalyticsSeriesPoint[] }>;
export type AnalyticsTopLinksResponse = ApiData<AnalyticsPeriod & { items: AnalyticsTopLink[] }>;
export type AnalyticsReferrersResponse = ApiData<AnalyticsPeriod & { items: AnalyticsReferrer[] }>;
export type AnalyticsGeoResponse = ApiData<AnalyticsPeriod & { items: AnalyticsGeo[] }>;
export type AnalyticsDevicesResponse = ApiData<AnalyticsPeriod & { items: AnalyticsDevice[] }>;
export type AnalyticsErrorCode = 'ANALYTICS_TARGET_NOT_FOUND' | 'PAGE_NOT_FOUND' | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED' | 'RATE_LIMITED' | 'DEPENDENCIES_UNAVAILABLE';
