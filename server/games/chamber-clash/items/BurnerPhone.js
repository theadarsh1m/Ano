const BaseItem = {
  id: 'burner_phone',
  name: 'Burner Phone',
  description: 'Reveal information about one upcoming shell in the chamber privately.',
  icon: '📞',
  rarity: 'rare',
  cooldown: 0,
  stackable: true,
  targetRules: 'self',
  
  canUse: (engine, playerId, targetId) => {
    return engine.currentChamberIndex < engine.chamber.length;
  },
  
  serverEffect: (engine, playerId, targetId) => {
    const currentIdx = engine.currentChamberIndex;
    const len = engine.chamber.length;
    
    let targetIdx = currentIdx; // Default to current shell if it's the last one
    if (currentIdx < len - 1) {
      // Pick a random upcoming shell index
      const min = currentIdx + 1;
      const max = len - 1;
      targetIdx = Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    const shell = engine.chamber[targetIdx];
    // Position relative to current: e.g. "2nd shell" (targetIdx - currentIdx + 1)
    const positionNumber = targetIdx - currentIdx + 1;
    
    engine.emitPrivateEvent(playerId, 'item_effect_burner_phone', {
      shell,
      position: positionNumber
    });
    
    return { success: true, message: `Revealed position ${positionNumber}.` };
  }
};

module.exports = BaseItem;
