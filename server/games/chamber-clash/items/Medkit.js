const BaseItem = {
  id: 'medkit',
  name: 'Medkit',
  description: 'Restores 1 HP. Cannot exceed max HP.',
  icon: '🩹',
  rarity: 'uncommon',
  cooldown: 0,
  stackable: true,
  targetRules: 'self',
  
  canUse: (engine, playerId, targetId) => {
    const player = engine.players.get(playerId);
    if (!player) return false;
    return player.hp < engine.settings.startingHp;
  },
  
  serverEffect: (engine, playerId, targetId) => {
    const player = engine.players.get(playerId);
    player.hp = Math.min(engine.settings.startingHp, player.hp + 1);
    
    // Broadcast heal event
    engine.emitPublicEvent('player_healed', {
      playerId,
      amount: 1,
      newHp: player.hp
    });
    
    return { success: true, message: 'Healed 1 HP.' };
  }
};

module.exports = BaseItem;
