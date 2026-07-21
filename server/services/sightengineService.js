const axios = require('axios');
const { evaluateModerationScores } = require('../config/moderationConfig');

const MAX_RETRIES = 3;

/**
 * Sends a Cloudinary URL to Sightengine for moderation.
 * Implements exponential backoff for network-related failures.
 * 
 * @param {string} imageUrl - The Cloudinary secure_url to moderate
 * @param {number} attempt - Current retry attempt (internal use)
 * @returns {Promise<Object>} { status, nudityScore, goreScore, rawModerationResponse }
 */
async function moderateImage(imageUrl, attempt = 1) {
  if (!imageUrl) {
    return {
      status: 'SAFE',
      nudityScore: 0,
      goreScore: 0,
      rawModerationResponse: null
    };
  }

  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;

  if (!apiUser || !apiSecret) {
    console.warn('[Sightengine] Missing API credentials. Bypassing moderation.');
    return {
      status: 'SAFE',
      nudityScore: 0,
      goreScore: 0,
      rawModerationResponse: null
    };
  }

  try {
    const startTime = Date.now();
    console.log(`[Sightengine] Moderating URL: ${imageUrl} (Attempt ${attempt})`);
    
    const response = await axios.get('https://api.sightengine.com/1.0/check.json', {
      params: {
        models: 'nudity-2.1,gore-2.0',
        api_user: apiUser,
        api_secret: apiSecret,
        url: imageUrl
      },
      timeout: 10000 // 10s timeout
    });

    const latency = Date.now() - startTime;
    const rawData = response.data;
    
    // Evaluate the response
    const evaluated = evaluateModerationScores(rawData);

    console.log(`[Sightengine] Scan complete in ${latency}ms | Status: ${evaluated.status} | Nudity: ${evaluated.nudityScore} | Gore: ${evaluated.goreScore}`);
    
    return {
      status: evaluated.status,
      nudityScore: evaluated.nudityScore,
      goreScore: evaluated.goreScore,
      rawModerationResponse: rawData
    };

  } catch (error) {
    const isNetworkError = !error.response;
    const statusCode = error.response ? error.response.status : null;

    // Do NOT retry 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden)
    if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
      console.error(`[Sightengine] Client Error (${statusCode}). Not retrying. Details:`, error.response?.data || error.message);
      return fallbackResponse();
    }

    if (isNetworkError || statusCode >= 500) {
      if (attempt < MAX_RETRIES) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s
        console.warn(`[Sightengine] Network failure: ${error.message}. Retrying in ${backoffMs}ms (Attempt ${attempt + 1}/${MAX_RETRIES})`);
        
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        return moderateImage(imageUrl, attempt + 1);
      } else {
        console.error(`[Sightengine] Exhausted retries for URL: ${imageUrl}. Error: ${error.message}`);
        return fallbackResponse();
      }
    }

    // Catch-all
    console.error(`[Sightengine] Unexpected error: ${error.message}`);
    return fallbackResponse();
  }
}

/**
 * Default response when Sightengine fails completely.
 * We do not reject the upload, but mark it for admin review.
 */
function fallbackResponse() {
  return {
    status: 'PENDING_MODERATION',
    nudityScore: null,
    goreScore: null,
    rawModerationResponse: { error: 'Service Unavailable or Failed' }
  };
}

module.exports = {
  moderateImage
};
