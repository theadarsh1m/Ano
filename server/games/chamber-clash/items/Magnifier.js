const BaseItem = {
  id: 'magnifier',
  name: 'Magnifying Glass',
  description: 'Inspect the current shell in the chamber privately.',
  icon: '🔍',
  rarity: 'common',
  cooldown: 0,
  stackable: true,
  targetRules: 'self', // self, opponent, any
  
  canUse: (engine, playerId, targetId) => {
    return true; // Usually always usable
  },
  
  serverEffect: (engine, playerId, targetId) => {
    const currentShell = engine.chamber[engine.currentChamberIndex];
    // Emit a private event to just this player revealing the shell
    engine.emitPrivateEvent(playerId, 'item_effect_magnifier', {
      shell: currentShell
    });
    
    return { success: true, message: 'Inspected chamber.' };
  }
};

module.exports = BaseItem;
