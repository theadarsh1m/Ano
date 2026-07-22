const BaseGameEngine = require('../engine/BaseGameEngine');

class FlappyBirdEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'FLAPPY_BIRD');
    this.status = 'LOBBY'; // 'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
    this.seed = Math.floor(Math.random() * 1000000);
    this.startTime = null;
    this.countdownValue = null;
    this.countdownTimer = null;
    this.playerResults = new Map();
    this.deathOrder = [];
  }

  startCountdown(onCountdownComplete) {
    if (this.status !== 'LOBBY') return false;

    this.status = 'COUNTDOWN';
    this.countdownValue = 3;
    this.seed = Math.floor(Math.random() * 1000000);

    for (const player of this.players.values()) {
      player.isAlive = true;
      player.score = 0;
      player.timeSurvived = 0;
      player.rank = null;
      player.status = 'PLAYING';
    }

    this.emit('game_countdown', {
      gameId: this.gameId,
      status: this.status,
      countdownValue: this.countdownValue,
      seed: this.seed
    });

    if (this.countdownTimer) clearInterval(this.countdownTimer);

    this.countdownTimer = setInterval(() => {
      if (this.countdownValue === null) return;
      this.countdownValue--;

      this.emit('game_countdown', {
        gameId: this.gameId,
        status: this.status,
        countdownValue: this.countdownValue,
        seed: this.seed
      });

      if (this.countdownValue <= 0) {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.countdownValue = null;
        this.startGame();
        if (typeof onCountdownComplete === 'function') {
          onCountdownComplete();
        }
      }
    }, 1000);

    return true;
  }

  startGame() {
    this.status = 'PLAYING';
    this.startTime = Date.now();
    this.playerResults.clear();
    this.deathOrder = [];

    for (const player of this.players.values()) {
      player.isAlive = true;
      player.score = 0;
      player.timeSurvived = 0;
      player.rank = null;
      player.status = 'PLAYING';
    }

    this.emit('game_started', {
      gameId: this.gameId,
      status: this.status,
      seed: this.seed,
      startTime: this.startTime
    });

    return {
      status: this.status,
      seed: this.seed,
      startTime: this.startTime
    };
  }

  serializeState(userId) {
    const playersArr = Array.from(this.players.values()).map(p => ({
      userId: p.userId,
      nickname: p.nickname,
      avatar: p.avatar || null,
      isReady: p.isReady ?? false,
      role: p.role || 'PLAYER',
      isAlive: p.isAlive ?? true,
      status: p.status || (this.status === 'LOBBY' ? (p.isReady ? 'READY' : 'WAITING') : 'PLAYING'),
      score: p.score ?? 0,
      timeSurvived: p.timeSurvived ?? 0,
      rank: p.rank ?? null
    }));

    return {
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      seed: this.seed,
      startTime: this.startTime,
      countdownValue: this.countdownValue,
      players: playersArr,
      results: Array.from(this.playerResults.values()),
      myUserId: userId
    };
  }

  handleJump(userId, y, vy) {
    const player = this.players.get(userId);
    if (!player || !player.isAlive || player.status !== 'PLAYING' || this.status !== 'PLAYING') {
      return null;
    }

    player.y = y;
    player.vy = vy;
    return { userId, y, vy };
  }

  handlePlayerDeath(userId, score, timeSurvived) {
    const player = this.players.get(userId);
    if (!player || !player.isAlive || this.status !== 'PLAYING') return null;

    player.isAlive = false;
    player.status = 'DEAD';
    player.score = score;
    player.timeSurvived = timeSurvived;

    if (!this.deathOrder.includes(userId)) {
      this.deathOrder.push(userId);
    }

    const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);

    if (alivePlayers.length === 0) {
      this.endGame();
    }

    return {
      userId,
      score,
      timeSurvived,
      aliveCount: alivePlayers.length,
      isGameOver: this.status === 'FINISHED'
    };
  }

  handleSpectate(userId) {
    const player = this.players.get(userId);
    if (!player) return null;

    player.status = 'SPECTATING';
    return { userId, status: player.status };
  }

  handleReturnToLobby(userId) {
    const player = this.players.get(userId);
    if (!player) return null;

    player.status = 'RETURNED_TO_LOBBY';
    if (player.isAlive && this.status === 'PLAYING') {
      player.isAlive = false;
      if (!this.deathOrder.includes(userId)) {
        this.deathOrder.push(userId);
      }
    }

    // Check if all remaining players are finished
    const activeMatchPlayers = Array.from(this.players.values()).filter(p => p.isAlive);
    if (activeMatchPlayers.length === 0 && this.status === 'PLAYING') {
      this.endGame();
    }

    return { userId, status: player.status, isGameOver: this.status === 'FINISHED' };
  }

  endGame() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.status = 'FINISHED';

    // Ensure all players are in deathOrder
    for (const p of this.players.values()) {
      if (!this.deathOrder.includes(p.userId)) {
        this.deathOrder.push(p.userId);
      }
    }

    const placements = [...this.deathOrder].reverse();

    placements.forEach((userId, index) => {
      const rank = index + 1;
      const player = this.players.get(userId);
      if (!player) return;

      player.rank = rank;
      this.playerResults.set(userId, {
        userId,
        rank,
        score: player.score ?? 0,
        timeSurvived: player.timeSurvived ?? 0
      });
    });

    this.emit('game_over', {
      gameId: this.gameId,
      status: this.status,
      results: Array.from(this.playerResults.values())
    });
  }

  resetToLobby() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.status = 'LOBBY';
    this.countdownValue = null;
    this.startTime = null;
    this.playerResults.clear();
    this.deathOrder = [];

    const hostUserId = Array.from(this.players.values()).find(p => p.role === 'HOST')?.userId;

    for (const player of this.players.values()) {
      player.isAlive = true;
      player.score = 0;
      player.timeSurvived = 0;
      player.rank = null;
      player.isReady = player.userId === hostUserId;
      player.status = player.userId === hostUserId ? 'READY' : 'WAITING';
    }

    this.emit('lobby_reset', {
      gameId: this.gameId,
      status: this.status
    });

    return this.serializeState(null);
  }
}

module.exports = FlappyBirdEngine;
