const cloudinary = require('cloudinary').v2;

// ========================
// Cloudinary Configuration
// ========================
// All credentials are loaded from environment variables.
// NEVER expose API_SECRET or API_KEY to the client.

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// ========================
// Folder Constants
// ========================
// Every upload MUST go under the Ano/ root folder.
// Uploading to the Cloudinary root is strictly forbidden.

const FOLDERS = {
  ROOT: 'Ano',
  CHAT_IMAGES: 'Ano/chat-images',
  PROFILE_PICTURES: 'Ano/profile-pictures',
  ATTACHMENTS: 'Ano/attachments',
};

// ========================
// Safe Config (client-exposable)
// ========================
// Only the cloud name is safe to send to the client.

const safeConfig = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
};

module.exports = { cloudinary, FOLDERS, safeConfig };
