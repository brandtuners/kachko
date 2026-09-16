import type { ApiData } from './index';

export interface MediaAsset {
  id: string;
  url: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  size: number;
  width: number;
  height: number;
  createdAt: string;
}
export interface MediaUploadTarget {
  storageKey: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}
export type MediaResponse = ApiData<MediaAsset>;
export type MediaListResponse = ApiData<MediaAsset[]>;
export type MediaErrorCode = 'UPLOAD_NOT_FOUND' | 'UPLOAD_MISMATCH' | 'UPLOAD_ALREADY_RECEIVED'
  | 'UPLOAD_INCOMPLETE' | 'INVALID_MEDIA' | 'MEDIA_NOT_FOUND' | 'MEDIA_IN_USE'
  | 'UNAUTHENTICATED' | 'CSRF_REJECTED' | 'RATE_LIMITED' | 'DEPENDENCIES_UNAVAILABLE';
