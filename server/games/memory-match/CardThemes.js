// Card theme sets for Memory Match
// Each set provides enough unique symbols for different board sizes

const EMOJI_THEMES = {
  animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦋', '🐢', '🐙', '🦑', '🐬', '🐠', '🦈', '🐊', '🐘', '🦒', '🦓', '🦘', '🦔', '🐿️'],
  food: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🌽', '🥕', '🧁', '🍩', '🍪', '🎂', '🍕', '🌮', '🍔', '🌭', '🍟', '🥐', '🧀', '🥚', '🥑', '🍫'],
  objects: ['⭐', '🌙', '☀️', '🌈', '🔥', '💧', '❄️', '⚡', '💎', '🎸', '🎹', '🎯', '🎨', '🏆', '🎭', '🚀', '🛸', '🎪', '🎬', '🎤', '🎧', '📷', '💡', '🔮', '🧲', '⚙️', '🗝️', '🎁', '🧩', '🪄', '🏅', '🎲'],
  nature: ['🌸', '🌺', '🌻', '🌹', '🌷', '🌵', '🍀', '🍁', '🍂', '🌿', '🪴', '🌴', '🌊', '⛰️', '🏔️', '🌋', '🗻', '🏝️', '🌅', '🌄', '🌠', '🌌', '☁️', '🌤️', '🌪️', '🌎', '💐', '🪷', '🪻', '🫧', '🦩', '🪸'],
};

/**
 * Get a random set of unique symbols for generating card pairs
 * @param {number} pairCount - Number of unique pairs needed
 * @returns {string[]} Array of unique symbols
 */
function getCardSymbols(pairCount) {
  // Combine all themes and shuffle
  const allSymbols = Object.values(EMOJI_THEMES).flat();

  // Shuffle using Fisher-Yates
  for (let i = allSymbols.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allSymbols[i], allSymbols[j]] = [allSymbols[j], allSymbols[i]];
  }

  return allSymbols.slice(0, pairCount);
}

/**
 * Calculate the best board dimensions for a given number of cards
 * @param {number} totalCards
 * @returns {{ rows: number, cols: number }}
 */
function calculateBoardDimensions(totalCards) {
  // Find the closest rectangle dimensions
  let bestRows = 1;
  let bestCols = totalCards;
  let bestDiff = totalCards - 1;

  for (let rows = 2; rows <= Math.ceil(Math.sqrt(totalCards)); rows++) {
    if (totalCards % rows === 0) {
      const cols = totalCards / rows;
      const diff = Math.abs(cols - rows);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestRows = rows;
        bestCols = cols;
      }
    }
  }

  return { rows: bestRows, cols: bestCols };
}

/**
 * Get the number of pairs based on player count
 * @param {number} playerCount
 * @returns {number}
 */
function getPairCount(playerCount) {
  if (playerCount <= 2) return 12;      // 4x6 = 24 cards
  if (playerCount <= 4) return 18;      // 6x6 = 36 cards
  if (playerCount <= 6) return 24;      // 6x8 = 48 cards
  return 32;                             // 8x8 = 64 cards
}

module.exports = { getCardSymbols, calculateBoardDimensions, getPairCount };
