const { RANK_TO_VALUE } = require('./Types');

class Rules {
  /**
   * Validate if the played cards match the declared rank.
   * If any card doesn't match, return false (meaning the player lied/bluffed).
   * If all cards match, return true (meaning the player told the truth).
   */
  static isTruth(playedCards, declaredRank) {
    const expectedValue = RANK_TO_VALUE[declaredRank];
    if (!expectedValue) return false;

    // Check if every single card matches the value of the declared rank
    return playedCards.every(card => card.value === expectedValue);
  }
}

module.exports = Rules;
