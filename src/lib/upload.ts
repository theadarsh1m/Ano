/**
 * Client-side upload helpers for Ano.
 *
 * All uploads go through the server API — Cloudinary secrets
 * never touch the browser. The server routes each file to the
 * correct Ano/ subfolder automatically.
 */

import type {
  ChatUploadApiResponse,
  ProfilePictureApiResponse,
  AttachmentUploadApiResponse,
  CloudinarySafeConfig,
} from '@/types/cloudinary';

import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_FILE_TYPES,
  MAX_IMAGE_SIZE,
  MAX_FILE_SIZE,
} from '@/types/cloudinary';

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

// Re-export validation constants so components can import from one place
export { ALLOWED_IMAGE_TYPES, ALLOWED_FILE_TYPES, MAX_IMAGE_SIZE, MAX_FILE_SIZE };

// ========================
// Validation
// ========================

/**
 * Check if a MIME type is an allowed image type.
 */
export function isImageType(mimeType: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Check if a MIME type is an allowed file type.
 */
export function isFileType(mimeType: string): boolean {
  return (ALLOWED_FILE_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Validate a file before uploading. Returns null if valid, or an error string.
 */
export function validateFile(file: File): string | null {
  const isImage = isImageType(file.type);
  const isDoc = isFileType(file.type);

  if (!isImage && !isDoc) {
    return 'Unsupported file type. Allowed: JPG, PNG, WEBP, GIF, PDF, DOCX, PPTX, TXT, ZIP';
  }

  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
  if (file.size > maxSize) {
    const limitMB = maxSize / (1024 * 1024);
    return `File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max ${limitMB}MB for ${isImage ? 'images' : 'files'}.`;
  }

  return null;
}

/**
 * Validate an image file specifically. Returns null if valid, or an error string.
 */
export function validateImageFile(file: File): string | null {
  if (!isImageType(file.type)) {
    return `Unsupported image type. Allowed: JPG, PNG, WEBP, GIF`;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return `Image too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max 10MB.`;
  }

  return null;
}

// ========================
// Format helpers
// ========================

/**
 * Format bytes into a human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ========================
// Upload functions
// ========================

/**
 * Upload a chat image or file attachment via the general endpoint.
 * The server auto-routes to Ano/chat-images or Ano/attachments.
 *
 * Uses XMLHttpRequest for progress tracking.
 */
export function uploadChatFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ChatUploadApiResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || 'Upload failed'));
        } catch {
          reject(new Error('Upload failed'));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    xhr.open('POST', `${API_URL}/api/upload`);
    xhr.send(formData);
  });
}

/**
 * Upload a profile picture. Stored in Ano/profile-pictures.
 * Overwrites the previous picture for the same userId.
 */
export async function uploadProfilePicture(
  file: File,
  userId: string,
): Promise<ProfilePictureApiResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId);

  const response = await fetch(`${API_URL}/api/upload/profile-picture`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Profile picture upload failed');
  }

  return response.json();
}

/**
 * Upload a file attachment explicitly to Ano/attachments.
 */
export async function uploadAttachment(
  file: File,
): Promise<AttachmentUploadApiResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/api/upload/attachment`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Attachment upload failed');
  }

  return response.json();
}

// ========================
// Delete functions
// ========================

/**
 * Delete an image from Cloudinary by its publicId.
 * Calls DELETE /api/upload/:publicId?type=image
 */
export async function deleteImage(publicId: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/upload?publicId=${encodeURIComponent(publicId)}&type=image`,
    { method: 'DELETE' },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Delete failed' }));
    throw new Error(err.error || 'Failed to delete image');
  }
}

/**
 * Delete a raw file/attachment from Cloudinary by its publicId.
 * Calls DELETE /api/upload/:publicId?type=raw
 */
export async function deleteAttachmentFile(publicId: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/upload?publicId=${encodeURIComponent(publicId)}&type=raw`,
    { method: 'DELETE' },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Delete failed' }));
    throw new Error(err.error || 'Failed to delete attachment');
  }
}

// ========================
// Config
// ========================

/**
 * Fetch the safe Cloudinary config (only cloud_name, no secrets).
 */
export async function getCloudinaryConfig(): Promise<CloudinarySafeConfig> {
  const response = await fetch(`${API_URL}/api/cloudinary/config`);
  if (!response.ok) {
    throw new Error('Failed to fetch Cloudinary config');
  }
  return response.json();
}
