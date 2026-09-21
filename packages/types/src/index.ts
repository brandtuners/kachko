/** Browser-safe contracts. Never export database models or session credentials. */
export interface IdentityUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
}
export interface ApiData<T> { data: T }
export type IdentityResponse = ApiData<IdentityUser>;
export type LogoutResponse = ApiData<{ loggedOut: true }>;
export type UsernameResponse = ApiData<{
  username: string;
  available: boolean;
  reason?: 'reserved' | 'taken';
}>;
export type IdentityErrorCode = 'VALIDATION_ERROR' | 'ACCOUNT_UNAVAILABLE' | 'USERNAME_UNAVAILABLE'
  | 'INVALID_CREDENTIALS' | 'UNAUTHENTICATED' | 'CSRF_REJECTED' | 'RATE_LIMITED' | 'DEPENDENCIES_UNAVAILABLE'
  | 'RESET_TOKEN_INVALID' | 'FORBIDDEN';
export interface ApiError { error: { code: string; message: string | string[] } }

export type GoogleCallbackResponse = ApiData<
  { onboardingRequired: true } | { onboardingRequired: false; user: IdentityUser } | { linkRequired: true }
>;
export type GooglePendingResponse = ApiData<{ email: string }>;
export type GoogleIdentityErrorCode = 'GOOGLE_NOT_CONFIGURED' | 'GOOGLE_AUTH_FAILED'
  | 'GOOGLE_STATE_INVALID' | 'GOOGLE_ONBOARDING_EXPIRED' | 'GOOGLE_LINK_EXPIRED'
  | 'GOOGLE_LINK_MISMATCH' | 'GOOGLE_ACCOUNT_UNAVAILABLE';

export * from './pages';

export * from './appearance';
export * from './media';
export * from './analytics';
export * from './moderation';
