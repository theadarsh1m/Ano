const BaseItem = {
  id: 'inverter',
  name: 'Inverter',
  description: 'Converts the current shell: Live becomes Blank, Blank becomes Live.',
  icon: '🔄',
  rarity: 'uncommon',
  cooldown: 0,
  stackable: true,
  targetRules: 'self',
  
  canUse: (engine, playerId, targetId) => {
    return engine.currentChamberIndex < engine.chamber.length;
  },
  
  serverEffect: (engine, playerId, targetId) => {
    const currentIdx = engine.currentChamberIndex;
    const currentShell = engine.chamber[currentIdx];
    const newShell = currentShell === 'LIVE' ? 'BLANK' : 'LIVE';
    engine.chamber[currentIdx] = newShell;
    
    // Get updated shell counts
    const shellCounts = engine.getRemainingShellCounts();
    
    // Emit public inverter event
    engine.emitPublicEvent('shell_inverted', {
      playerId,
      newShell,
      ...shellCounts
    });
    
    return { success: true, message: `Inverted shell to ${newShell}.` };
  }
};

module.exports = BaseItem;
