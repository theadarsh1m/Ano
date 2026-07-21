// Configuration and thresholds for Sightengine moderation
// We are evaluating: nudity-2.1 and gore-2.0

const MODERATION_CONFIG = {
  // If any of these thresholds are met, the image is considered EXPLICIT
  explicitThresholds: {
    nudity: 0.8,
    gore: 0.8
  },
  
  // If any of these thresholds are met (but explicit isn't), the image is QUESTIONABLE
  questionableThresholds: {
    nudity: 0.1,
    gore: 0.1
  }
};

/**
 * Evaluate the raw API response from Sightengine to determine the final status.
 * @param {Object} response - The parsed JSON response from Sightengine
 * @returns {Object} { status, nudityScore, goreScore }
 */
function evaluateModerationScores(response) {
  let status = 'SAFE';
  
  // Nudity scoring
  let nudityScore = 0;
  if (response.nudity) {
    // nudity-2.1 provides several sub-scores. We take the maximum of explicit categories
    nudityScore = Math.max(
      response.nudity.sexual_activity || 0,
      response.nudity.sexual_display || 0,
      response.nudity.erotica || 0,
      response.nudity.suggestive || 0 // suggestive is questionable
    );
  }

  // Gore scoring
  let goreScore = 0;
  if (response.gore) {
    goreScore = response.gore.prob || 0;
  }

  if (
    nudityScore >= MODERATION_CONFIG.questionableThresholds.nudity ||
    goreScore >= MODERATION_CONFIG.questionableThresholds.gore ||
    nudityScore >= MODERATION_CONFIG.explicitThresholds.nudity ||
    goreScore >= MODERATION_CONFIG.explicitThresholds.gore
  ) {
    status = 'SENSITIVE';
  } else {
    status = 'SAFE';
  }

  return {
    status,
    nudityScore,
    goreScore
  };
}

module.exports = {
  MODERATION_CONFIG,
  evaluateModerationScores
};
