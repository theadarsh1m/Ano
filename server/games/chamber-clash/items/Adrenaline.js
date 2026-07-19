const BaseItem = {
  id: 'adrenaline',
  name: 'Adrenaline',
  description: 'Steal and immediately use an opponent\'s item.',
  icon: '💉',
  rarity: 'rare',
  cooldown: 0,
  stackable: true,
  targetRules: 'other',
  
  canUse: (engine, playerId, targetId) => {
    // Return true if there is at least one living opponent with items in inventory
    let hasTarget = false;
    engine.players.forEach(p => {
      if (p.userId !== playerId && p.isAlive && p.inventory.length > 0) {
        hasTarget = true;
      }
    });
    return hasTarget;
  },
  
  serverEffect: (engine, playerId, targetId, data) => {
    const ItemRegistry = require('./ItemRegistry');

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
    
    const itemIndex = target.inventory.findIndex(id => id === stolenItemId);
    if (itemIndex === -1) {
      return { success: false, error: 'Target does not have this item' };
    }
    
    // Perform the steal
    target.inventory.splice(itemIndex, 1);
    
    // Broadcast steal event
    engine.emitPublicEvent('item_stolen', {
      stealerId: playerId,
      victimId: targetId,
      itemId: stolenItemId
    });

    // Immediately execute stolen item effect
    const stolenItemDef = ItemRegistry.getItem(stolenItemId);
    if (stolenItemDef) {
      // For handcuffs, target is the victim (targetId). For self rules, target is self (playerId).
      const targetForEffect = stolenItemDef.targetRules === 'other' ? targetId : playerId;
      
      // Emit item_used for the stolen item to trigger client animations
      engine.emitPublicEvent('item_used', {
        playerId,
        itemId: stolenItemId,
        targetId: targetForEffect
      });

      stolenItemDef.serverEffect(engine, playerId, targetForEffect, data);
    }
    
    return { success: true, message: `Stole and used ${stolenItemId} from ${target.nickname}` };
  }
};

module.exports = BaseItem;
