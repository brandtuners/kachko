/** Browser-safe contracts. Never export database models or session credentials. */
export interface IdentityUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
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
  | 'INVALID_CREDENTIALS' | 'UNAUTHENTICATED' | 'CSRF_REJECTED' | 'RATE_LIMITED' | 'DEPENDENCIES_UNAVAILABLE';
export interface ApiError { error: { code: string; message: string | string[] } }

export type GoogleCallbackResponse = ApiData<
  { onboardingRequired: true } | { onboardingRequired: false; user: IdentityUser }
>;
export type GooglePendingResponse = ApiData<{ email: string }>;
export type GoogleIdentityErrorCode = 'GOOGLE_NOT_CONFIGURED' | 'GOOGLE_AUTH_FAILED'
  | 'GOOGLE_STATE_INVALID' | 'GOOGLE_ONBOARDING_EXPIRED' | 'ACCOUNT_LINK_REQUIRED';

export * from './pages';

export * from './appearance';
export * from './media';
