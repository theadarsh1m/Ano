const BaseItem = {
  id: 'shield',
  name: 'Energy Shield',
  description: 'Blocks the next instance of damage.',
  icon: '🛡️',
  rarity: 'rare',
  cooldown: 0,
  stackable: true,
  targetRules: 'self',
  
  canUse: (engine, playerId, targetId) => {
    const player = engine.players.get(playerId);
    if (!player) return false;
    return !player.statusEffects.some(e => e.type === 'SHIELDED');
  },
  
  serverEffect: (engine, playerId, targetId) => {
    const player = engine.players.get(playerId);
    
    player.statusEffects.push({
      type: 'SHIELDED',
      duration: -1, // Lasts until broken
      source: playerId
    });
    
    engine.emitPublicEvent('status_added', {
      playerId: playerId,
      status: 'SHIELDED',
      duration: -1,
      source: playerId
    });
    
    return { success: true, message: 'Shield applied.' };
  }
};

module.exports = BaseItem;
