const BaseGameEngine = require('../engine/BaseGameEngine');

// ═══════════════════════════════════════════════════════════
// Arrow Maze — Server-Side Game Engine
// Manages multiplayer state, shared seed, and results
// ═══════════════════════════════════════════════════════════

class ArrowMazeEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'ARROW_MAZE');
    this.seed = Math.floor(Math.random() * 2147483647);
    this.settings = {
      multiplayerMode: 'LEVELS',  // 'LEVELS' or 'TIMED'
      levelCount: 10,
      timedDuration: 180,         // seconds (timed mode)
      deadTimeLimit: 60,          // seconds per level (levels mode)
      maxPlayers: 8,
    };
    this.startTime = null;
    this.countdownTimer = null;
    this.matchTimer = null;
    this.deadTimeTimer = null;
    this.playerStates = new Map(); // userId -> state
    this.results = null;
    this.currentMatchLevel = 1;
    this.levelFirstSolver = new Map(); // level -> userId (first to solve)
  }

  startGame() {
    this.seed = Math.floor(Math.random() * 2147483647);
    this.status = 'PLAYING';
    this.startTime = Date.now();
    this.results = null;
    this.currentMatchLevel = 1;
    this.levelFirstSolver.clear();

    // Initialize player states
    for (const [userId, player] of this.players) {
      this.playerStates.set(userId, {
        userId,
        nickname: player.nickname,
        avatar: player.avatar,
        score: 0,
        currentLevel: 1,
        levelsCleared: 0,
        totalArrowsCleared: 0,
        totalMistakes: 0,
        livesRemaining: 3,
        levelTimes: [],
        finishedAt: null,
        status: 'PLAYING',
      });
    }

    // Countdown 3-2-1
    let count = 3;
    this.emit('game_countdown', { countdownValue: count, seed: this.seed });

    this.countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        this.emit('game_countdown', { countdownValue: count, seed: this.seed });
      } else {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;

        // Actually start
        this.emit('game_started', {
          gameId: this.gameId,
          status: 'PLAYING',
          seed: this.seed,
          startTime: this.startTime,
          settings: this.settings,
        });

        // Set match timer for timed mode
        if (this.settings.multiplayerMode === 'TIMED') {
          this.matchTimer = setTimeout(() => {
            this.endMatch();
          }, this.settings.timedDuration * 1000);
        }
      }
    }, 1000);
  }

  handlePlayerAction(playerId, action, data) {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    switch (action) {
      case 'progress': {
        state.score = data.score ?? state.score;
        state.currentLevel = data.level ?? state.currentLevel;
        state.levelsCleared = data.levelsCleared ?? state.levelsCleared;
        state.livesRemaining = data.livesRemaining ?? state.livesRemaining;

        // Broadcast progress to all
        this.emit('arrowmaze_player_progress', {
          userId: playerId,
          score: state.score,
          level: state.currentLevel,
          levelsCleared: state.levelsCleared,
          livesRemaining: state.livesRemaining,
          progress: data.progress ?? 0,
        });
        break;
      }

      case 'level_cleared': {
        const level = data.level;
        state.levelsCleared = data.levelsCleared ?? (state.levelsCleared + 1);
        state.score = data.score ?? state.score;

        // First solver bonus (levels mode)
        if (this.settings.multiplayerMode === 'LEVELS' && !this.levelFirstSolver.has(level)) {
          this.levelFirstSolver.set(level, playerId);
          const bonus = level * 100;
          state.score += bonus;
          // Notify the player of their bonus
          this.emitPrivateEvent(playerId, 'arrowmaze_first_solver_bonus', { level, bonus });
        }

        // Check if all levels completed (levels mode)
        if (this.settings.multiplayerMode === 'LEVELS') {
          if (state.levelsCleared >= this.settings.levelCount) {
            state.status = 'FINISHED';
            state.finishedAt = Date.now();
            // Check if all players finished or just end the match
            this.checkAllFinished();
          }
        }

        // Broadcast updated progress
        this.emit('arrowmaze_player_progress', {
          userId: playerId,
          score: state.score,
          level: state.currentLevel,
          levelsCleared: state.levelsCleared,
          livesRemaining: state.livesRemaining,
          progress: 0,
        });
        break;
      }

      case 'life_lost': {
        state.livesRemaining = data.livesRemaining ?? Math.max(0, state.livesRemaining - 1);
        state.totalMistakes++;
        break;
      }

      case 'finished': {
        state.status = 'FINISHED';
        state.finishedAt = Date.now();
        if (data.stats) {
          state.score = data.stats.score ?? state.score;
          state.levelsCleared = data.stats.levelsCleared ?? state.levelsCleared;
          state.totalArrowsCleared = data.stats.totalArrowsCleared ?? state.totalArrowsCleared;
          state.totalMistakes = data.stats.totalMistakes ?? state.totalMistakes;
          if (data.stats.avgTimePerLevel) state.avgTimePerLevel = data.stats.avgTimePerLevel;
          if (data.stats.fastestLevel) state.fastestLevel = data.stats.fastestLevel;
        }

        this.checkAllFinished();
        break;
      }

      case 'return_to_lobby': {
        state.status = 'FINISHED';
        this.checkAllFinished();
        break;
      }

      default:
        break;
    }
  }

  checkAllFinished() {
    let allFinished = true;
    for (const [, ps] of this.playerStates) {
      if (ps.status !== 'FINISHED') { allFinished = false; break; }
    }
    if (allFinished) {
      this.endMatch();
    }
  }

  endMatch() {
    if (this.status === 'FINISHED') return; // Already ended
    this.status = 'FINISHED';

    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    if (this.matchTimer) { clearTimeout(this.matchTimer); this.matchTimer = null; }
    if (this.deadTimeTimer) { clearTimeout(this.deadTimeTimer); this.deadTimeTimer = null; }

    // Compile results
    const results = [];
    for (const [userId, state] of this.playerStates) {
      const avgTime = state.levelTimes && state.levelTimes.length > 0
        ? state.levelTimes.reduce((a, b) => a + b, 0) / state.levelTimes.length
        : (state.avgTimePerLevel || 0);
      const fastest = state.levelTimes && state.levelTimes.length > 0
        ? Math.min(...state.levelTimes)
        : (state.fastestLevel || 0);

      results.push({
        userId: state.userId,
        nickname: state.nickname,
        avatar: state.avatar,
        rank: 0,
        score: state.score,
        levelsCleared: state.levelsCleared,
        totalArrowsCleared: state.totalArrowsCleared,
        totalMistakes: state.totalMistakes,
        avgTimePerLevel: avgTime,
        fastestLevel: fastest,
        finishedAt: state.finishedAt,
      });
    }

    // Sort: in timed mode → levels cleared desc, then score desc.
    // In levels mode → score desc.
    if (this.settings.multiplayerMode === 'TIMED') {
      results.sort((a, b) => {
        if (b.levelsCleared !== a.levelsCleared) return b.levelsCleared - a.levelsCleared;
        return b.score - a.score;
      });
    } else {
      results.sort((a, b) => b.score - a.score);
    }

    results.forEach((r, i) => { r.rank = i + 1; });

    this.results = results;
    this.emit('game_over', { gameId: this.gameId, results });
  }

  updateSettings(settings) {
    if (settings.multiplayerMode) this.settings.multiplayerMode = settings.multiplayerMode;
    if (settings.levelCount) this.settings.levelCount = settings.levelCount;
    if (settings.timedDuration) this.settings.timedDuration = settings.timedDuration;
    if (settings.deadTimeLimit) this.settings.deadTimeLimit = settings.deadTimeLimit;
    if (settings.maxPlayers) this.settings.maxPlayers = settings.maxPlayers;
  }

  validateAction(playerId, action, data) {
    return this.playerStates.has(playerId) || this.players.has(playerId);
  }

  endGame(winnerId) {
    this.endMatch();
  }

  handlePlayerDisconnect(userId) {
    this.removePlayer(userId);
  }

  removePlayer(userId) {
    if (this.players.has(userId)) {
      this.players.delete(userId);
      if (this.status === 'PLAYING') {
        const state = this.playerStates.get(userId);
        if (state) {
          state.status = 'FINISHED';
          state.finishedAt = Date.now();
        }

        let activePlayers = 0;
        for (const [id, ps] of this.playerStates) {
          if (this.players.has(id) && ps.status === 'PLAYING') { activePlayers++; }
        }

        const wasMultiplayer = this.playerStates.size > 1;
        if ((wasMultiplayer && activePlayers <= 1) || (!wasMultiplayer && activePlayers === 0)) {
          this.endMatch();
        }
      } else if (this.status === 'WAITING' && this.players.size === 0) {
        this.status = 'FINISHED';
      }
      return true;
    }
    return false;
  }

  serializeState(privatePlayerId) {
    const players = [];
    for (const [userId, player] of this.players) {
      const pState = this.playerStates.get(userId);
      players.push({
        userId,
        nickname: player.nickname,
        avatar: player.avatar,
        isReady: player.isReady,
        role: player.role,
        isHost: player.isHost,
        status: pState?.status || 'WAITING',
        score: pState?.score ?? 0,
        currentLevel: pState?.currentLevel ?? 1,
        levelsCleared: pState?.levelsCleared ?? 0,
        livesRemaining: pState?.livesRemaining ?? 3,
      });
    }

    return {
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      seed: this.seed,
      startTime: this.startTime,
      settings: this.settings,
      players,
      results: this.results,
    };
  }

  restoreState(state) {
    this.status = state.status;
    this.seed = state.seed;
    this.startTime = state.startTime;
    if (state.settings) this.settings = state.settings;
    if (state.results) this.results = state.results;
  }
}

module.exports = ArrowMazeEngine;
