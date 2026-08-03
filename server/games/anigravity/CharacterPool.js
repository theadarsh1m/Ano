const { CHARACTER_DEFINITIONS } = require('./characters');

function getRandomCharacter(excludeIds = []) {
  const available = CHARACTER_DEFINITIONS.filter(c => !excludeIds.includes(c.id));
  const pool = available.length > 0 ? available : CHARACTER_DEFINITIONS;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

module.exports = { getRandomCharacter, CHARACTER_DEFINITIONS };
