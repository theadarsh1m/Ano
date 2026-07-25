
const BaseItem = {
  id: 'adrenaline',
  name: 'Adrenaline',
  description: 'Steal an opponent\'s item.',
  icon: '💉',
  rarity: 'rare',
  cooldown: 0,
  stackable: true,
  targetRules: 'opponent',
  
  canUse: (engine, playerId, targetId) => {
    // Return true if there is at least one living opponent with stealable non-adrenaline items
    let hasTarget = false;
    engine.players.forEach(p => {
      if (p.userId !== playerId && p.isAlive) {
        const stealableItems = p.inventory.filter(id => id !== 'adrenaline');
        if (stealableItems.length > 0) {
          hasTarget = true;
        }
      }
    });
    return hasTarget;
  },
  
  serverEffect: (engine, playerId, targetId, data) => {
    if (!targetId) {
      return { success: false, error: 'No target specified' };
    }
    
    const target = engine.players.get(targetId);
    if (!target || !target.isAlive || targetId === playerId) {
      return { success: false, error: 'Invalid target player' };
    }
    
    const stolenItemId = data?.stolenItemId;
    if (!stolenItemId) {
      return { success: false, error: 'No item selected to steal' };
    }

    if (stolenItemId === 'adrenaline') {
      return { success: false, error: 'Adrenaline cannot steal another Adrenaline.' };
    }
    
    const itemIndex = target.inventory.findIndex(id => id === stolenItemId);
    if (itemIndex === -1) {
      return { success: false, error: 'Target does not have this item' };
    }
    
    const ItemRegistry = require('./ItemRegistry');
    const stolenItemDef = ItemRegistry.getItem(stolenItemId);
    if (!stolenItemDef) {
      return { success: false, error: 'Unknown stolen item' };
    }
    
    // Perform the steal (remove from victim)
    target.inventory.splice(itemIndex, 1);
    
    // Broadcast steal event
    engine.emitPublicEvent('item_stolen', {
      stealerId: playerId,
      victimId: targetId,
      itemId: stolenItemId
    });

    // Check if the stolen item explicitly requires the player to select a target
    if (stolenItemDef.targetRules === 'opponent' || stolenItemDef.targetRules === 'any') {
      engine.pendingItemAction = {
        sourceItem: 'adrenaline',
        stolenItem: stolenItemId,
        playerId: playerId,
        stage: 'SELECT_TARGET'
      };
      
      // Do not advance turn, require the player to select a target
      return { 
        success: true, 
        message: `Stole ${stolenItemId}. Target required.`, 
        effectResult: { advanceTurn: false } 
      };
    } else {
      // Execute immediately using the unified pipeline
      // Items that target 'self' or 'none' will resolve automatically
      const targetIdForEffect = stolenItemDef.targetRules === 'self' ? playerId : null;
      return engine.executeItemEffect(playerId, stolenItemId, targetIdForEffect, data, 'ADRENALINE');
    }
  }
};

module.exports = BaseItem;
