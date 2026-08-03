class TurnManager {
  constructor(players, turnDurationSeconds = 30) {
    this.players = players.filter(p => !p.isSpectator);
    this.turnDurationSeconds = turnDurationSeconds;
    this.turnOrder = [];
    this.currentIndex = -1;
    this.turnTimer = null;
    this.remainingSeconds = turnDurationSeconds;
    this.onTickCallback = null;
    this.onTimeoutCallback = null;
  }

  start(onTick, onTimeout) {
    this.onTickCallback = onTick;
    this.onTimeoutCallback = onTimeout;
    this.players.forEach(p => { p.isEliminated = false; });
    const ids = this.players.map(p => p.userId || p.id);
    // Fisher-Yates shuffle
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    this.turnOrder = ids;
    this.players.forEach(p => { p.turnOrder = this.turnOrder.indexOf(p.userId || p.id); });
    this.currentIndex = 0;
    this.startTurnTimer();
    return this.getCurrentPlayerId();
  }

  startTurnTimer() {
    this.clearTurnTimer();
    this.remainingSeconds = this.turnDurationSeconds;
    if (this.onTickCallback) {
      this.onTickCallback(this.remainingSeconds);
    }
    this.turnTimer = setInterval(() => {
      this.remainingSeconds--;
      if (this.onTickCallback) {
        this.onTickCallback(this.remainingSeconds);
      }
      if (this.remainingSeconds <= 0) {
        this.clearTurnTimer();
        if (this.onTimeoutCallback) {
          this.onTimeoutCallback(this.getCurrentPlayerId());
        }
      }
    }, 1000);
  }

  clearTurnTimer() {
    if (this.turnTimer) {
      clearInterval(this.turnTimer);
      this.turnTimer = null;
    }
  }

  nextTurn() {
    this.clearTurnTimer();
    if (this.isGameOver()) return null;
    
    do {
      this.currentIndex = (this.currentIndex + 1) % this.turnOrder.length;
    } while (this.getPlayer(this.turnOrder[this.currentIndex])?.isEliminated);
    
    this.startTurnTimer();
    return this.getCurrentPlayerId();
  }

  eliminatePlayer(playerId) {
    const player = this.getPlayer(playerId);
    if (player) {
      player.isEliminated = true;
    }
  }

  getPlayer(playerId) {
    return this.players.find(p => (p.userId || p.id) === playerId);
  }

  getCurrentPlayerId() {
    if (this.currentIndex >= 0 && this.currentIndex < this.turnOrder.length) {
      return this.turnOrder[this.currentIndex];
    }
    return null;
  }

  getNextPlayerId() {
    if (this.isGameOver()) return null;
    let nextIndex = this.currentIndex;
    do {
      nextIndex = (nextIndex + 1) % this.turnOrder.length;
    } while (this.getPlayer(this.turnOrder[nextIndex])?.isEliminated);
    return this.turnOrder[nextIndex];
  }

  getTurnOrder() {
    return this.turnOrder;
  }

  getSecondsRemaining() {
    return this.remainingSeconds;
  }

  getActivePlayersCount() {
    return this.players.filter(p => !p.isEliminated).length;
  }

  isGameOver() {
    return this.getActivePlayersCount() <= 1;
  }

  getWinner() {
    if (this.isGameOver()) {
      const active = this.players.filter(p => !p.isEliminated);
      return active.length > 0 ? (active[0].userId || active[0].id) : null;
    }
    return null;
  }
}

module.exports = { TurnManager };
