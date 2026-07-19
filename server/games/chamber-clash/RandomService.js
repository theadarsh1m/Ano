/**
 * RandomService handles all RNG elements for Chamber Clash.
 * Extracted so it can be stubbed for tests or replaced with an external entropy source if needed.
 */
class RandomService {
  /**
   * Shuffles an array in place.
   */
  static shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
  }

  /**
   * Generates a chamber with live and blank shells.
   * Ensures at least one live and one blank in every chamber if size > 1.
   */
  static generateChamber(size) {
    if (size <= 1) return ['LIVE'];

    // Randomize number of live shells, usually around half
    const minLive = 1;
    const maxLive = size - 1;
    // Base it loosely on half, with some variance (+/- 1 or 2)
    let liveCount = Math.floor(size / 2) + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 2);
    
    // Clamp
    liveCount = Math.max(minLive, Math.min(liveCount, maxLive));
    
    const blankCount = size - liveCount;
    
    const chamber = [];
    for (let i = 0; i < liveCount; i++) chamber.push('LIVE');
    for (let i = 0; i < blankCount; i++) chamber.push('BLANK');
    
    return this.shuffle(chamber);
  }

  /**
   * Picks a random item ID based on weights/rarity.
   */
  static drawItem(itemRegistry) {
    const items = Object.values(itemRegistry.getAllItems());
    if (items.length === 0) return null;

    // Extremely simple unweighted draw for now, can be expanded to use `rarity`
    return items[Math.floor(Math.random() * items.length)].id;
  }

  /**
   * Returns a random integer between min and max (inclusive).
   */
  static randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

module.exports = RandomService;
