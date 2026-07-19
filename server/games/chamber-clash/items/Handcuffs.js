const BaseItem = {
  id: 'handcuffs',
  name: 'Handcuffs',
  description: 'Target skips their next turn.',
  icon: '🔗',
  rarity: 'rare',
  cooldown: 0,
  stackable: true,
  targetRules: 'opponent', // Can only target opponents
  
  canUse: (engine, playerId, targetId) => {
    if (!targetId || targetId === playerId) return false;
    const target = engine.players.get(targetId);
    if (!target || target.hp <= 0) return false;
    // Don't handcuff if they are already handcuffed
    return !target.statusEffects.some(e => e.type === 'SKIP_TURN');
  },
  
  serverEffect: (engine, playerId, targetId) => {
    const target = engine.players.get(targetId);
    
    // Add status effect
    target.statusEffects.push({
      type: 'SKIP_TURN',
      duration: 1, // 1 turn skip
      source: playerId
    });
    
    engine.emitPublicEvent('status_added', {
      playerId: targetId,
      status: 'SKIP_TURN',
      duration: 1,
      source: playerId
    });
    
    return { success: true, message: `Handcuffed player ${target.nickname}.` };
  }
};

module.exports = BaseItem;
