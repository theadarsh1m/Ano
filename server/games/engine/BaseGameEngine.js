class BaseGameEngine {
  constructor(gameId, gameType) {
    this.gameId = gameId;
    this.gameType = gameType; // GameType enum e.g. "BLUFF"
    this.status = 'WAITING'; // GameStatus enum: "WAITING", "PLAYING", "FINISHED"
    this.players = new Map(); // userId -> { userId, nickname, role: PlayerRole, isReady: boolean, isOnline: boolean }
    this.spectators = new Set(); // userId
  }

  startGame() {
    throw new Error('startGame() not implemented');
  }

  handlePlayerAction(playerId, action, data) {
    throw new Error('handlePlayerAction() not implemented');
  }

  validateAction(playerId, action, data) {
    throw new Error('validateAction() not implemented');
  }

  removePlayer(userId) {
    if (this.players.has(userId)) {
      this.players.delete(userId);
      if (this.players.size < 2 && this.status !== 'FINISHED') {
         this.status = 'FINISHED';
      }
      return true;
    }
    return false;
  }

  endGame(winnerId) {
    throw new Error('endGame() not implemented');
  }

  serializeState(privatePlayerId) {
    throw new Error('serializeState() not implemented');
  }

  restoreState(state) {
    throw new Error('restoreState() not implemented');
  }
}

module.exports = BaseGameEngine;
