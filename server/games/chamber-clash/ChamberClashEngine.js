const BaseGameEngine = require('../engine/BaseGameEngine');
const GamePersistenceService = require('../services/GamePersistenceService');
const ItemRegistry = require('./items/ItemRegistry');
const RandomService = require('./RandomService');

class ChamberClashEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'CHAMBER_CLASH');
    this.status = 'WAITING';
    
    this.settings = {
      startingHp: 5,
      turnTimer: 30,
      chamberSize: 6,
      maxInventory: 5,
      isPrivate: false
    };

    this.roundNumber = 0;
    this.currentChamberIndex = 0;
    this.chamber = [];
    
    this.turnOrder = [];
    this.currentTurnIndex = 0;

    this.turnTimerId = null;
    this.startTime = null;
    this.historyLogs = [];
    this.winnerId = null;
    this.actionQueue = [];
  }

  // --- EVENTS SYSTEM ---

  emitPublicEvent(type, payload) {
    this.historyLogs.push({ timestamp: Date.now(), type, payload });
    
    if (this.onEvent) {
      this.onEvent(type, payload);
    } else {
      this._pendingBroadcastEvents = this._pendingBroadcastEvents || [];
      this._pendingBroadcastEvents.push({ type, data: payload });
    }
  }
  
  emitPrivateEvent(userId, type, payload) {
    if (this.onPrivateEvent) {
      this.onPrivateEvent(userId, type, payload);
    } else {
      this._pendingPrivateEvents = this._pendingPrivateEvents || [];
      this._pendingPrivateEvents.push({ userId, type, data: payload });
    }
  }
  
  getPendingEvents() {
    const pub = this._pendingBroadcastEvents || [];
    const priv = this._pendingPrivateEvents || [];
    this._pendingBroadcastEvents = [];
    this._pendingPrivateEvents = [];
    return { public: pub, private: priv };
  }

  // Helper: compute remaining shell counts from current index onward
  getRemainingShellCounts() {
    const remaining = this.chamber.slice(this.currentChamberIndex);
    const live = remaining.filter(s => s === 'LIVE').length;
    return { remainingLive: live, remainingBlank: remaining.length - live, remainingTotal: remaining.length };
  }

  // --- GAME LIFECYCLE ---
  
  startGame() {
    this.status = 'ROUND_START';
    this.startTime = Date.now();
    this.roundNumber = 0;
    this.winnerId = null;
    this.historyLogs = [];
    
    const playerIds = Array.from(this.players.keys());
    this.turnOrder = RandomService.shuffle([...playerIds]);

    this.players.forEach(p => {
      p.hp = this.settings.startingHp;
      p.inventory = [];
      p.statusEffects = [];
      p.isAlive = true;
    });

    this.emitPublicEvent('game_started', {
      turnOrder: this.turnOrder,
      settings: this.settings
    });

    this.startNextRound();
  }
  
  startNextRound() {
    this.roundNumber++;
    this.currentChamberIndex = 0;
    
    this.chamber = RandomService.generateChamber(this.settings.chamberSize);
    const liveCount = this.chamber.filter(s => s === 'LIVE').length;
    const blankCount = this.chamber.length - liveCount;

    // Clear all player status effects at the beginning of each round
    this.players.forEach(p => {
      p.statusEffects = [];
    });
    
    this.emitPublicEvent('round_started', {
      roundNumber: this.roundNumber,
      totalShells: this.chamber.length,
      liveShells: liveCount,
      blankShells: blankCount
    });

    // Distribute items (1 to 3 items per round)
    this.distributeItems(RandomService.randomInt(1, 3));
    
    this.startTurnSequence();
  }
  
  distributeItems(amount) {
    const given = {};
    this.players.forEach(p => {
      if (!p.isAlive) return;
      given[p.userId] = [];
      for (let i = 0; i < amount; i++) {
        if (p.inventory.length >= this.settings.maxInventory) break;
        const itemId = RandomService.drawItem(ItemRegistry);
        if (itemId) {
          p.inventory.push(itemId);
          given[p.userId].push(itemId);
        }
      }
    });
    
    this.emitPublicEvent('items_distributed', { itemsGiven: given });
  }

  // --- TURN LOGIC ---

  startTurnSequence() {
    this.turnOrder = this.turnOrder.filter(id => {
      const p = this.players.get(id);
      return p && p.isAlive;
    });
    
    if (this.turnOrder.length <= 1) {
      this.endGame(this.turnOrder[0] || null);
      return;
    }
    
    // Chamber empty → new round
    if (this.currentChamberIndex >= this.chamber.length) {
      this.status = 'ROUND_END';
      this.emitPublicEvent('round_finished', { roundNumber: this.roundNumber });
      setTimeout(() => this.startNextRound(), 3000);
      return;
    }
    
    this.currentTurnIndex = this.currentTurnIndex % this.turnOrder.length;
    const currentTurnId = this.turnOrder[this.currentTurnIndex];
    const currentPlayer = this.players.get(currentTurnId);
    
    // Process status effects
    let skipTurn = false;
    currentPlayer.statusEffects = currentPlayer.statusEffects.filter(effect => {
      if (effect.type === 'SKIP_TURN') {
        skipTurn = true;
        effect.duration--;
        if (effect.duration <= 0) {
          this.emitPublicEvent('status_removed', { playerId: currentTurnId, status: 'SKIP_TURN' });
          return false;
        }
      }
      return true;
    });
    
    if (skipTurn) {
      this.emitPublicEvent('turn_skipped', { playerId: currentTurnId });
      this.advanceTurn();
      return;
    }

    this.status = 'PLAYER_TURN';
    this.startTurnTimer(currentTurnId);
    this.emitPublicEvent('turn_started', {
      playerId: currentTurnId,
      timer: this.settings.turnTimer,
      ...this.getRemainingShellCounts()
    });
  }

  advanceTurn() {
    this.clearTurnTimer();
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
    this.startTurnSequence();
  }

  startTurnTimer(playerId) {
    this.clearTurnTimer();
    const seconds = Number(this.settings.turnTimer) || 30;
    this.turnTimerId = setTimeout(() => {
      this.emitPublicEvent('turn_timeout', { playerId });
      this.advanceTurn();
    }, seconds * 1000);
  }

  clearTurnTimer() {
    if (this.turnTimerId) {
      clearTimeout(this.turnTimerId);
      this.turnTimerId = null;
    }
  }

  // --- ACTIONS ---

  handlePlayerAction(playerId, action, data) {
    if (this.status === 'FINISHED') return { success: false, error: 'Game finished' };
    
    const activePlayerId = this.turnOrder[this.currentTurnIndex];
    if (playerId !== activePlayerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (this.status !== 'PLAYER_TURN') {
      return { success: false, error: 'Invalid state for actions' };
    }

    let result = { success: false, error: 'Unknown action' };
    
    if (action === 'shoot_target') {
      result = this.actionShoot(playerId, data.targetId);
    } else if (action === 'use_item') {
      result = this.actionUseItem(playerId, data.itemId, data.targetId, data);
    }
    
    if (result.success) {
      const events = this.getPendingEvents();
      result.broadcastEvents = events.public;
      result.privateEvents = events.private;
      result.forceStateSync = true;
    }

    return result;
  }

  actionShoot(playerId, targetId) {
    if (!targetId) return { success: false, error: 'No target specified' };
    
    const target = this.players.get(targetId);
    if (!target || !target.isAlive) return { success: false, error: 'Invalid target' };

    const shell = this.chamber[this.currentChamberIndex];
    this.currentChamberIndex++;

    const shooter = this.players.get(playerId);
    let damageAmount = 1;

    // Check double damage (Handsaw)
    if (shooter && shooter.statusEffects) {
      const doubleDmgIndex = shooter.statusEffects.findIndex(e => e.type === 'DOUBLE_DAMAGE');
      if (doubleDmgIndex !== -1) {
        damageAmount = 2;
        shooter.statusEffects.splice(doubleDmgIndex, 1);
        this.emitPublicEvent('status_removed', { playerId, status: 'DOUBLE_DAMAGE' });
      }
    }

    const shellCounts = this.getRemainingShellCounts();

    this.emitPublicEvent('shot_fired', {
      shooterId: playerId,
      targetId: targetId,
      shellType: shell,
      damage: shell === 'LIVE' ? damageAmount : 0,
      ...shellCounts
    });

    let advance = true;

    if (shell === 'LIVE') {
      target.hp -= damageAmount;
      this.emitPublicEvent('player_damaged', { playerId: targetId, damage: damageAmount, newHp: target.hp });
      
      if (target.hp <= 0) {
        target.isAlive = false;
        this.emitPublicEvent('player_eliminated', { playerId: targetId });
      }
    } else {
      // Blank: self-shot grants extra turn
      if (playerId === targetId) {
        advance = false;
        this.emitPublicEvent('extra_turn_granted', { playerId });
      }
    }

    if (advance) {
      this.advanceTurn();
    } else {
      this.startTurnSequence(); 
    }

    return { success: true };
  }

  actionUseItem(playerId, itemId, targetId, data) {
    const player = this.players.get(playerId);
    const itemIndex = player.inventory.findIndex(id => id === itemId);
    
    if (itemIndex === -1) {
      return { success: false, error: 'Item not in inventory' };
    }

    const itemDef = ItemRegistry.getItem(itemId);
    if (!itemDef) {
      return { success: false, error: 'Unknown item' };
    }

    if (!itemDef.canUse(this, playerId, targetId)) {
      return { success: false, error: 'Cannot use item right now' };
    }

    player.inventory.splice(itemIndex, 1);
    
    this.emitPublicEvent('item_used', {
      playerId,
      itemId,
      targetId
    });

    const effectResult = itemDef.serverEffect(this, playerId, targetId, data);
    
    return { success: true, effectResult };
  }

  // --- END GAME ---
  
  endGame(winnerId) {
    this.status = 'FINISHED';
    this.winnerId = winnerId;
    this.clearTurnTimer();
    
    const winnerPlayer = this.players.get(winnerId);
    if (winnerPlayer) {
      this.historyLogs.push({ timestamp: Date.now(), type: 'victory', payload: { winnerId } });
      this.emitPublicEvent('game_finished', { winnerId, winnerName: winnerPlayer.nickname });
      
      const durationSeconds = Math.floor((Date.now() - (this.startTime || Date.now())) / 1000);
      GamePersistenceService.recordResult(this.gameId, winnerId, durationSeconds).catch(console.error);
    } else {
      this.emitPublicEvent('game_finished', { winnerId: null, isDraw: true });
    }
  }

  removePlayer(userId) {
    if (this.players.has(userId)) {
      const p = this.players.get(userId);
      if (p.isAlive) {
        p.isAlive = false;
        this.emitPublicEvent('player_eliminated', { playerId: userId, reason: 'disconnected' });
        
        this.turnOrder = this.turnOrder.filter(id => id !== userId);
        
        if (this.turnOrder[this.currentTurnIndex] === userId) {
           this.advanceTurn();
        } else if (this.turnOrder.length <= 1) {
           this.endGame(this.turnOrder[0] || null);
        }
      }
      p.isOnline = false;
      return true;
    }
    return false;
  }

  serializeState(privatePlayerId) {
    const playersList = [];
    this.players.forEach((p, id) => {
      playersList.push({
        userId: p.userId,
        nickname: p.nickname,
        role: p.role,
        isReady: p.isReady,
        isOnline: p.isOnline,
        isAlive: p.isAlive,
        hp: p.hp,
        inventory: p.inventory,
        statusEffects: p.statusEffects
      });
    });
    
    // Only count REMAINING shells (from currentChamberIndex onward)
    const remaining = this.chamber ? this.chamber.slice(this.currentChamberIndex) : [];
    const liveCount = remaining.filter(s => s === 'LIVE').length;
    const blankCount = remaining.length - liveCount;

    return {
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      settings: this.settings,
      roundNumber: this.roundNumber,
      players: playersList,
      currentTurnPlayerId: this.turnOrder[this.currentTurnIndex] || null,
      totalShells: remaining.length,
      liveShells: liveCount,
      blankShells: blankCount,
      currentChamberIndex: this.currentChamberIndex,
      winnerId: this.winnerId
    };
  }
}

module.exports = ChamberClashEngine;
