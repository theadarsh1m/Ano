const BaseItem = {
  id: 'beer',
  name: 'Beer',
  description: 'Eject the current shell without firing, revealing its type to everyone.',
  icon: '🍺',
  rarity: 'common',
  cooldown: 0,
  stackable: true,
  targetRules: 'self',
  
  canUse: (engine, playerId, targetId) => {
    return engine.currentChamberIndex < engine.chamber.length;
  },
  
  serverEffect: (engine, playerId, targetId) => {
    const currentShell = engine.chamber[engine.currentChamberIndex];
    engine.currentChamberIndex++;
    
    // Get updated counts
    const shellCounts = engine.getRemainingShellCounts();
    
    // Broadcast ejection event
    engine.emitPublicEvent('shell_ejected', {
      playerId,
      shellType: currentShell,
      ...shellCounts
    });
    
    return { success: true, message: `Ejected ${currentShell} shell.` };
  }
};

module.exports = BaseItem;
