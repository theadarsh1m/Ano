const { cloudinary, FOLDERS } = require('../config/cloudinary');

// ========================
// Allowed MIME types
// ========================

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'text/plain',
  'application/zip',
];

// ========================
// Size limits (bytes)
// ========================

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;  // 25 MB

// ========================
// Upload Service
// ========================

const uploadService = {
  // ---------------------
  // Type Checks
  // ---------------------

  /**
   * Check if a MIME type is an allowed image.
   */
  isImage(mimeType) {
    return ALLOWED_IMAGE_TYPES.includes(mimeType);
  },

  /**
   * Check if a MIME type is an allowed file/attachment.
   */
  isAllowedFile(mimeType) {
    return ALLOWED_FILE_TYPES.includes(mimeType);
  },

  // ---------------------
  // Validation
  // ---------------------

  /**
   * Validate a multer file object before upload.
   * @returns {{ valid: boolean, error?: string }}
   */
  validate(file) {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    const isImg = this.isImage(file.mimetype);
    const isDoc = this.isAllowedFile(file.mimetype);

    if (!isImg && !isDoc) {
      return {
        valid: false,
        error: `Unsupported file type: ${file.mimetype}. Allowed: JPG, PNG, WEBP, GIF, PDF, DOCX, PPTX, TXT, ZIP`,
      };
    }

    const maxSize = isImg ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      const limitMB = maxSize / (1024 * 1024);
      return {
        valid: false,
        error: `File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max ${limitMB}MB for ${isImg ? 'images' : 'files'}.`,
      };
    }

    return { valid: true };
  },

  /**
   * Validate only for image uploads (profile pictures, chat images).
   * @returns {{ valid: boolean, error?: string }}
   */
  validateImage(file) {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    if (!this.isImage(file.mimetype)) {
      return {
        valid: false,
        error: `Unsupported image type: ${file.mimetype}. Allowed: JPG, PNG, WEBP, GIF`,
      };
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return {
        valid: false,
        error: `Image too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max 10MB.`,
      };
    }

    return { valid: true };
  },

  // ---------------------
  // Upload: Chat Images
  // ---------------------

  /**
   * Upload a chat image to Ano/chat-images/.
   * @param {Buffer} fileBuffer
   * @param {string} originalName
   * @returns {Promise<{ publicId, secureUrl, width, height, format }>}
   */
  async uploadChatImage(fileBuffer, originalName) {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: FOLDERS.CHAT_IMAGES,
        resource_type: 'image',
        public_id: `${Date.now()}_${originalName.replace(/\.[^/.]+$/, '')}`,
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else {
            resolve({
              publicId: result.public_id,
              secureUrl: result.secure_url,
              width: result.width,
              height: result.height,
              format: result.format,
            });
          }
        }
      );

      uploadStream.end(fileBuffer);
    });
  },

  // ---------------------
  // Upload: Profile Pictures
  // ---------------------

  /**
   * Upload a profile picture to Ano/profile-pictures/.
   * Uses the userId as the public_id so re-uploads overwrite the old one.
   * @param {Buffer} fileBuffer
   * @param {string} userId - Used as the unique public_id
   * @returns {Promise<{ publicId, secureUrl }>}
   */
  async uploadProfilePicture(fileBuffer, userId) {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: FOLDERS.PROFILE_PICTURES,
        resource_type: 'image',
        public_id: userId,
        overwrite: true,
        transformation: [
          { width: 256, height: 256, crop: 'fill', gravity: 'face' },
        ],
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else {
            resolve({
              publicId: result.public_id,
              secureUrl: result.secure_url,
            });
          }
        }
      );

      uploadStream.end(fileBuffer);
    });
  },

  // ---------------------
  // Upload: Attachments
  // ---------------------

  /**
   * Upload a file attachment to Ano/attachments/.
   * Supports PDF, DOCX, PPTX, TXT, ZIP.
   * @param {Buffer} fileBuffer
   * @param {string} originalName
   * @returns {Promise<{ publicId, secureUrl, format, bytes }>}
   */
  async uploadAttachment(fileBuffer, originalName) {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: FOLDERS.ATTACHMENTS,
        resource_type: 'raw',
        public_id: `${Date.now()}_${originalName.replace(/\.[^/.]+$/, '')}`,
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else {
            resolve({
              publicId: result.public_id,
              secureUrl: result.secure_url,
              format: result.format,
              bytes: result.bytes,
            });
          }
        }
      );

      uploadStream.end(fileBuffer);
    });
  },

  // ---------------------
  // Legacy: uploadFile (auto-routes to correct folder)
  // ---------------------

  /**
   * Upload any valid file. Auto-routes images to chat-images and
   * documents to attachments. Used by the general /api/upload endpoint.
   * @param {Buffer} fileBuffer
   * @param {string} originalName
   * @param {string} mimeType
   * @returns {Promise<{ publicId, secureUrl, width?, height?, format, bytes }>}
   */
  async uploadFile(fileBuffer, originalName, mimeType) {
    if (this.isImage(mimeType)) {
      return this.uploadChatImage(fileBuffer, originalName);
    }
    return this.uploadAttachment(fileBuffer, originalName);
  },

  // ---------------------
  // Delete: Images
  // ---------------------

  /**
   * Delete an image from Cloudinary by its public_id.
   * @param {string} publicId - The full public_id (e.g. "Ano/chat-images/123_photo")
   * @returns {Promise<{ result: string }>}
   */
  async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
      });
      return result;
    } catch (error) {
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  },

  // ---------------------
  // Delete: Attachments
  // ---------------------

  /**
   * Delete a raw file/attachment from Cloudinary by its public_id.
   * @param {string} publicId - The full public_id (e.g. "Ano/attachments/123_report")
   * @returns {Promise<{ result: string }>}
   */
  async deleteAttachment(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw',
      });
      return result;
    } catch (error) {
      throw new Error(`Failed to delete attachment: ${error.message}`);
    }
  },
};

module.exports = uploadService;
