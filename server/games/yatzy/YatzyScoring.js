/**
 * YatzyScoring.js — Pure scoring logic for Yatzy
 * Data-driven and modular to support future Yatzy variants.
 */

// All scoring categories
const UPPER_CATEGORIES = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
const LOWER_CATEGORIES = ['one_pair', 'two_pair', 'three_of_a_kind', 'four_of_a_kind', 'full_house', 'small_straight', 'large_straight', 'chance', 'yatzy'];
const ALL_CATEGORIES = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES];

const DEFAULT_BONUS_THRESHOLD = 63;
const DEFAULT_BONUS_VALUE = 50;

/**
 * Count occurrences of each die face value
 * @param {number[]} dice - Array of 5 dice values (1-6)
 * @returns {Object} counts keyed by face value
 */
function countDice(dice) {
  const counts = {};
  for (const d of dice) {
    counts[d] = (counts[d] || 0) + 1;
  }
  return counts;
}

/**
 * Get dice values sorted descending
 */
function sortedDesc(dice) {
  return [...dice].sort((a, b) => b - a);
}

/**
 * Calculate score for a specific category given 5 dice
 * @param {number[]} dice - Array of 5 dice values (1-6)
 * @param {string} category - Scoring category name
 * @returns {number} The score (0 if the combination doesn't qualify)
 */
function calculateScore(dice, category) {
  const counts = countDice(dice);
  const sorted = sortedDesc(dice);
  const sum = dice.reduce((a, b) => a + b, 0);

  switch (category) {
    // Upper section — sum of matching dice
    case 'ones':   return (counts[1] || 0) * 1;
    case 'twos':   return (counts[2] || 0) * 2;
    case 'threes': return (counts[3] || 0) * 3;
    case 'fours':  return (counts[4] || 0) * 4;
    case 'fives':  return (counts[5] || 0) * 5;
    case 'sixes':  return (counts[6] || 0) * 6;

    // One Pair — highest pair
    case 'one_pair': {
      for (let v = 6; v >= 1; v--) {
        if ((counts[v] || 0) >= 2) return v * 2;
      }
      return 0;
    }

    // Two Pair — two different pairs
    case 'two_pair': {
      const pairs = [];
      for (let v = 6; v >= 1; v--) {
        if ((counts[v] || 0) >= 2) pairs.push(v);
      }
      if (pairs.length >= 2) return pairs[0] * 2 + pairs[1] * 2;
      return 0;
    }

    // Three of a Kind
    case 'three_of_a_kind': {
      for (let v = 6; v >= 1; v--) {
        if ((counts[v] || 0) >= 3) return v * 3;
      }
      return 0;
    }

    // Four of a Kind
    case 'four_of_a_kind': {
      for (let v = 6; v >= 1; v--) {
        if ((counts[v] || 0) >= 4) return v * 4;
      }
      return 0;
    }

    // Full House — three of one kind + two of another
    case 'full_house': {
      let hasThree = false, hasTwo = false;
      let threeVal = 0, twoVal = 0;
      for (const [v, c] of Object.entries(counts)) {
        if (c >= 3) { hasThree = true; threeVal = parseInt(v); }
        if (c >= 2 && c < 3) { hasTwo = true; twoVal = parseInt(v); }
      }
      // Also handle 5-of-a-kind as NOT a full house (need two different values)
      if (hasThree && hasTwo && threeVal !== twoVal) {
        return threeVal * 3 + twoVal * 2;
      }
      return 0;
    }

    // Small Straight — 1,2,3,4,5
    case 'small_straight': {
      const s = [...new Set(sorted)].sort((a, b) => a - b);
      if (s.length === 5 && s[0] === 1 && s[4] === 5) return 15;
      return 0;
    }

    // Large Straight — 2,3,4,5,6
    case 'large_straight': {
      const s = [...new Set(sorted)].sort((a, b) => a - b);
      if (s.length === 5 && s[0] === 2 && s[4] === 6) return 20;
      return 0;
    }

    // Chance — sum of all dice
    case 'chance': return sum;

    // Yatzy — all five dice the same
    case 'yatzy': {
      const values = Object.values(counts);
      if (values.length === 1 && values[0] === 5) return 50;
      return 0;
    }

    default:
      return 0;
  }
}

/**
 * Calculate scores for ALL categories given 5 dice
 * @param {number[]} dice
 * @returns {Object} { category: score } for every category
 */
function calculateAllPossible(dice) {
  const result = {};
  for (const cat of ALL_CATEGORIES) {
    result[cat] = calculateScore(dice, cat);
  }
  return result;
}

/**
 * Check if a category name is valid
 */
function isValidCategory(category) {
  return ALL_CATEGORIES.includes(category);
}

/**
 * Calculate upper section total
 */
function calculateUpperTotal(scoreSheet) {
  let total = 0;
  for (const cat of UPPER_CATEGORIES) {
    if (scoreSheet[cat] !== null && scoreSheet[cat] !== undefined) {
      total += scoreSheet[cat];
    }
  }
  return total;
}

/**
 * Calculate lower section total
 */
function calculateLowerTotal(scoreSheet) {
  let total = 0;
  for (const cat of LOWER_CATEGORIES) {
    if (scoreSheet[cat] !== null && scoreSheet[cat] !== undefined) {
      total += scoreSheet[cat];
    }
  }
  return total;
}

/**
 * Calculate bonus
 */
function calculateBonus(scoreSheet, threshold = DEFAULT_BONUS_THRESHOLD) {
  const upperTotal = calculateUpperTotal(scoreSheet);
  return upperTotal >= threshold ? DEFAULT_BONUS_VALUE : 0;
}

/**
 * Calculate grand total
 */
function calculateGrandTotal(scoreSheet, bonusThreshold = DEFAULT_BONUS_THRESHOLD) {
  const upper = calculateUpperTotal(scoreSheet);
  const bonus = upper >= bonusThreshold ? DEFAULT_BONUS_VALUE : 0;
  const lower = calculateLowerTotal(scoreSheet);
  return upper + bonus + lower;
}

/**
 * Check if a score sheet is complete (all categories filled)
 */
function isScoreSheetComplete(scoreSheet) {
  return ALL_CATEGORIES.every(cat => scoreSheet[cat] !== null && scoreSheet[cat] !== undefined);
}

/**
 * Create an empty score sheet
 */
function createEmptyScoreSheet() {
  const sheet = {};
  for (const cat of ALL_CATEGORIES) {
    sheet[cat] = null;
  }
  return sheet;
}

/**
 * Human-readable category names for display
 */
const CATEGORY_DISPLAY_NAMES = {
  ones: 'Ones',
  twos: 'Twos',
  threes: 'Threes',
  fours: 'Fours',
  fives: 'Fives',
  sixes: 'Sixes',
  one_pair: 'One Pair',
  two_pair: 'Two Pair',
  three_of_a_kind: 'Three of a Kind',
  four_of_a_kind: 'Four of a Kind',
  full_house: 'Full House',
  small_straight: 'Small Straight',
  large_straight: 'Large Straight',
  chance: 'Chance',
  yatzy: 'Yatzy',
};

module.exports = {
  UPPER_CATEGORIES,
  LOWER_CATEGORIES,
  ALL_CATEGORIES,
  CATEGORY_DISPLAY_NAMES,
  DEFAULT_BONUS_THRESHOLD,
  DEFAULT_BONUS_VALUE,
  calculateScore,
  calculateAllPossible,
  isValidCategory,
  calculateUpperTotal,
  calculateLowerTotal,
  calculateBonus,
  calculateGrandTotal,
  isScoreSheetComplete,
  createEmptyScoreSheet,
};
