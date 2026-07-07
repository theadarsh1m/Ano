const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Bluff declared ranks (mapped from values)
const DECLARED_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];

const VALUE_TO_RANK = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
  'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace'
};

const RANK_TO_VALUE = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
  'Jack': 'J', 'Queen': 'Q', 'King': 'K', 'Ace': 'A'
};

module.exports = {
  SUITS,
  VALUES,
  DECLARED_RANKS,
  VALUE_TO_RANK,
  RANK_TO_VALUE
};
