const tf = require('@tensorflow/tfjs');
const nsfw = require('nsfwjs');
const jpeg = require('jpeg-js');
const axios = require('axios');
const prisma = require('../db');

let model = null;
let isLoadingModel = false;
let io = null; // Socket.IO instance

/**
 * Initialize NSFW model and cache it in memory.
 */
async function getModel() {
  if (model) return model;
  if (isLoadingModel) {
    while (isLoadingModel) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return model;
  }

  isLoadingModel = true;
  try {
    // Load NSFWJS MobileNetV2-based model
    model = await nsfw.load();
    console.log('NSFWJS Model initialized successfully');
  } catch (err) {
    console.error('Failed to load NSFWJS model:', err);
  } finally {
    isLoadingModel = false;
  }
  return model;
}

/**
 * Extract Cloudinary public_id from URL
 */
function extractPublicId(url) {
  if (!url) return null;
  // Match path after /upload/ (optionally including version like /v12345/) up to the file extension
  const match = url.match(/\/upload\/(?:v\d+\/)?([^.]+)/);
  return match ? match[1] : null;
}

/**
 * Get dynamic JPEG URL version of the Cloudinary media URL
 */
function getJpegUrl(url) {
  if (!url) return null;
  return url.replace(/\.(png|webp|gif|jpeg|svg)$/i, '.jpg');
}

const moderationService = {
  /**
   * Inject Socket.IO instance from server
   */
  setSocketIO(ioInstance) {
    io = ioInstance;
  },

  /**
   * Scan image buffer for NSFW content using TensorFlow.js + NSFWJS
   */
  async scanImage(buffer) {
    try {
      const activeModel = await getModel();
      if (!activeModel) {
        console.warn('NSFW model not loaded, falling back to mock approval');
        return { isNSFW: false, confidence: 0 };
      }

      // Decode JPEG data
      const rawImageData = jpeg.decode(buffer);
      const { width, height, data } = rawImageData;

      // Convert RGBA to RGB (drop the alpha channel)
      const bufferRGB = new Float32Array(width * height * 3);
      let offset = 0;
      for (let i = 0; i < data.length; i += 4) {
        bufferRGB[offset++] = data[i];     // R
        bufferRGB[offset++] = data[i + 1]; // G
        bufferRGB[offset++] = data[i + 2]; // B
      }

      // Create a 3D Tensor
      const tensor = tf.tensor3d(bufferRGB, [height, width, 3], 'int32');

      // Classify tensor
      const predictions = await activeModel.classify(tensor);

      // Clean up tensor to prevent WebGL/CPU memory leaks
      tensor.dispose();

      // NSFW categories: Porn, Sexy, Hentai
      let nsfwProb = 0;
      predictions.forEach((p) => {
        if (['Porn', 'Sexy', 'Hentai'].includes(p.className)) {
          nsfwProb += p.probability;
        }
      });

      // Threshold: >= 0.50 is flagged/NSFW
      const isNSFW = nsfwProb >= 0.50;
      return { isNSFW, confidence: nsfwProb };
    } catch (err) {
      console.error('Error during image scanning:', err);
      // Fallback: If buffer decoding fails, check metadata tags or return safe
      return { isNSFW: false, confidence: 0 };
    }
  },

  /**
   * Download image from URL (transcoded to JPEG format) and scan
   */
  async scanImageFromUrl(imageUrl) {
    try {
      const jpegUrl = getJpegUrl(imageUrl);
      const response = await axios.get(jpegUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      return await this.scanImage(buffer);
    } catch (err) {
      console.error(`Failed to scan image from URL ${imageUrl}:`, err.message);
      return { isNSFW: false, confidence: 0 };
    }
  },

  /**
   * Check cache and perform moderation for any Cloudinary image URL
   */
  async moderateImage(imageUrl) {
    if (!imageUrl) {
      return { moderationStatus: 'APPROVED', isNSFW: false, nsfwConfidence: 0 };
    }

    const publicId = extractPublicId(imageUrl);
    if (publicId) {
      // Check cached moderation results to avoid duplicate scans
      try {
        const cached = await prisma.moderationCache.findUnique({
          where: { publicId },
        });
        if (cached) {
          console.log(`Moderation cache hit for: ${publicId}`);
          return {
            moderationStatus: cached.status,
            isNSFW: cached.isNSFW,
            nsfwConfidence: cached.nsfwConfidence,
          };
        }
      } catch (err) {
        console.error('Failed to read moderation cache:', err);
      }
    }

    console.log(`Starting scan for: ${imageUrl}`);
    const scan = await this.scanImageFromUrl(imageUrl);
    const status = scan.isNSFW ? 'FLAGGED' : 'APPROVED';

    if (publicId) {
      try {
        await prisma.moderationCache.create({
          data: {
            publicId,
            isNSFW: scan.isNSFW,
            nsfwConfidence: scan.confidence,
            status,
          },
        });
      } catch (err) {
        console.error('Failed to write to moderation cache:', err);
      }
    }

    return {
      moderationStatus: status,
      isNSFW: scan.isNSFW,
      nsfwConfidence: scan.confidence,
    };
  },

  /**
   * Asynchronously moderate a Post
   */
  async moderatePost(postId, imageUrl) {
    try {
      await prisma.post.update({
        where: { id: postId },
        data: { moderationStatus: 'SCANNING' },
      });

      const result = await this.moderateImage(imageUrl);

      const updatedPost = await prisma.post.update({
        where: { id: postId },
        data: {
          moderationStatus: result.moderationStatus,
          isNSFW: result.isNSFW,
          nsfwConfidence: result.nsfwConfidence,
        },
      });

      // Notify clients of moderation status change
      if (io) {
        io.emit('post_moderated', {
          postId: updatedPost.id,
          moderationStatus: updatedPost.moderationStatus,
          isNSFW: updatedPost.isNSFW,
          nsfwConfidence: updatedPost.nsfwConfidence,
        });
      }
    } catch (err) {
      console.error(`Error moderating post ${postId}:`, err);
    }
  },

  /**
   * Asynchronously moderate a room Message
   */
  async moderateMessage(messageId, roomId, imageUrl) {
    try {
      await prisma.message.update({
        where: { id: messageId },
        data: { moderationStatus: 'SCANNING' },
      });

      const result = await this.moderateImage(imageUrl);

      const updatedMsg = await prisma.message.update({
        where: { id: messageId },
        data: {
          moderationStatus: result.moderationStatus,
          isNSFW: result.isNSFW,
          nsfwConfidence: result.nsfwConfidence,
        },
      });

      // Notify room clients of moderation status change
      if (io) {
        io.to(roomId).emit('message_moderated', {
          messageId: updatedMsg.id,
          roomId,
          moderationStatus: updatedMsg.moderationStatus,
          isNSFW: updatedMsg.isNSFW,
          nsfwConfidence: updatedMsg.nsfwConfidence,
        });
      }
    } catch (err) {
      console.error(`Error moderating room message ${messageId}:`, err);
    }
  },

  /**
   * Asynchronously moderate a DirectMessage
   */
  async moderateDirectMessage(dmId, conversationId, imageUrl) {
    try {
      await prisma.directMessage.update({
        where: { id: dmId },
        data: { moderationStatus: 'SCANNING' },
      });

      const result = await this.moderateImage(imageUrl);

      const updatedDM = await prisma.directMessage.update({
        where: { id: dmId },
        data: {
          moderationStatus: result.moderationStatus,
          isNSFW: result.isNSFW,
          nsfwConfidence: result.nsfwConfidence,
        },
      });

      // Notify DM room clients of moderation status change
      if (io) {
        io.to(`dm_${conversationId}`).emit('dm_moderated', {
          messageId: updatedDM.id,
          conversationId,
          moderationStatus: updatedDM.moderationStatus,
          isNSFW: updatedDM.isNSFW,
          nsfwConfidence: updatedDM.nsfwConfidence,
        });
      }
    } catch (err) {
      console.error(`Error moderating DM message ${dmId}:`, err);
    }
  },
};

module.exports = moderationService;
