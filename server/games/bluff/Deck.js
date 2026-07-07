const { SUITS, VALUES } = require('./Types');

class Deck {
  static createDeck() {
    const deck = [];
    let id = 1;
    for (const suit of SUITS) {
      for (const value of VALUES) {
        deck.push({ id: `card_${id++}`, suit, value });
      }
    }
    return deck;
  }

  static shuffle(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static deal(deck, playerCount) {
    const hands = Array.from({ length: playerCount }, () => []);
    deck.forEach((card, index) => {
      hands[index % playerCount].push(card);
    });
    return hands;
  }
}

module.exports = Deck;
