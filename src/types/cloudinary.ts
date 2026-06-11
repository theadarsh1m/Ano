// ========================
// Cloudinary TypeScript Types
// ========================

/**
 * Result returned from any Cloudinary upload.
 */
export interface UploadResult {
  publicId: string;
  secureUrl: string;
  format: string;
  bytes: number;
  resourceType: 'image' | 'raw' | 'video';
  folder: string;
  createdAt: string;
}

/**
 * Extended result for image uploads, includes dimensions.
 */
export interface ImageUploadResponse extends UploadResult {
  width: number;
  height: number;
}

/**
 * Result for file/attachment uploads (no dimensions).
 */
export interface FileUploadResponse extends UploadResult {
  originalFilename: string;
}

/**
 * A Cloudinary asset reference stored in the database.
 */
export interface CloudinaryAsset {
  publicId: string;
  secureUrl: string;
  format?: string;
  resourceType: 'image' | 'raw' | 'video';
}

/**
 * Upload target folders. Mirrors server-side FOLDERS constant.
 */
export const UPLOAD_FOLDERS = {
  CHAT_IMAGES: 'Ano/chat-images',
  PROFILE_PICTURES: 'Ano/profile-pictures',
  ATTACHMENTS: 'Ano/attachments',
} as const;

export type UploadFolder = typeof UPLOAD_FOLDERS[keyof typeof UPLOAD_FOLDERS];

/**
 * The API response shape from POST /api/upload (chat images).
 */
export interface ChatUploadApiResponse {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

/**
 * The API response shape from POST /api/upload/profile-picture.
 */
export interface ProfilePictureApiResponse {
  publicId: string;
  secureUrl: string;
}

/**
 * The API response shape from POST /api/upload/attachment.
 */
export interface AttachmentUploadApiResponse {
  publicId: string;
  secureUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

/**
 * Safe Cloudinary config (no secrets, okay to expose to client).
 */
export interface CloudinarySafeConfig {
  cloudName: string;
}

// ========================
// File validation constants
// ========================

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'text/plain',
  'application/zip',
] as const;

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_FILE_SIZE = 25 * 1024 * 1024;   // 25 MB

export type AllowedImageType = typeof ALLOWED_IMAGE_TYPES[number];
export type AllowedFileType = typeof ALLOWED_FILE_TYPES[number];
