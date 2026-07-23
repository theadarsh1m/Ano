const BaseItem = {
  id: 'adrenaline',
  name: 'Adrenaline',
  description: 'Steal an opponent\'s item.',
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
    
    const stealer = engine.players.get(playerId);
    if (stealer.inventory.length < engine.settings.maxInventory) {
      stealer.inventory.push(stolenItemId);
    }
    
    // Broadcast steal event
    engine.emitPublicEvent('item_stolen', {
      stealerId: playerId,
      victimId: targetId,
      itemId: stolenItemId
    });

    return { success: true, message: `Stole ${stolenItemId} from ${target.nickname}` };
  }
};

module.exports = BaseItem;
