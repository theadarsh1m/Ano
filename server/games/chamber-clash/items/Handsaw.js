const BaseItem = {
  id: 'handsaw',
  name: 'Handsaw',
  description: 'Saws off the barrel to deal double damage on the next shot.',
  icon: '🪚',
  rarity: 'rare',
  cooldown: 0,
  stackable: true,
  targetRules: 'self',
  
  canUse: (engine, playerId, targetId) => {
    const player = engine.players.get(playerId);
    if (!player) return false;
    return !player.statusEffects.some(e => e.type === 'DOUBLE_DAMAGE');
  },
  
  serverEffect: (engine, playerId, targetId) => {
    const player = engine.players.get(playerId);
    
    player.statusEffects.push({
      type: 'DOUBLE_DAMAGE',
      duration: -1, // Lasts until consumed or round ends
      source: playerId
    });
    
    engine.emitPublicEvent('status_added', {
      playerId,
      status: 'DOUBLE_DAMAGE',
      duration: -1,
      source: playerId
    });
    
    return { success: true, message: 'Sharpened the shotgun.' };
  }
};

module.exports = BaseItem;
