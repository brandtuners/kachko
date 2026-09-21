import type { ApiData } from './index';

export type ReportReason = 'SPAM' | 'HARASSMENT' | 'IMPERSONATION' | 'ILLEGAL_CONTENT' | 'OTHER';
export type ReportStatus = 'OPEN' | 'RESOLVED' | 'REJECTED';
export interface ModerationReport {
  id: string;
  reason: ReportReason;
  status: ReportStatus;
  details: string | null;
  createdAt: string;
  page: { id: string; slug: string; isPrimary: boolean; user: { id: string; username: string; isActive: boolean } };
  reporter: { username: string } | null;
}
export type CreateReportResponse = ApiData<{ accepted: true }>;
export type ModerationReportsResponse = ApiData<ModerationReport[]>;
