const BaseGameEngine = require('../engine/BaseGameEngine');

// ═══════════════════════════════════════════════════════════
// PaperFall — Server-Side Game Engine
// Manages multiplayer state, shared word seeds, and results
// ═══════════════════════════════════════════════════════════

class PaperFallEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'PAPER_FALL');
    this.seed = Math.floor(Math.random() * 2147483647);
    this.settings = {
      difficulty: 'MEDIUM',
      matchDuration: 300,
      maxPlayers: 8,
    };
    this.startTime = null;
    this.countdownTimer = null;
    this.matchTimer = null;
    this.playerStates = new Map(); // userId -> { score, wordsTyped, wpm, accuracy, level, wpmHistory, finishedAt }
    this.results = null;
  }

  startGame() {
    this.seed = Math.floor(Math.random() * 2147483647);
    this.status = 'PLAYING';
    this.startTime = Date.now();
    this.results = null;

    // Initialize player states
    for (const [userId, player] of this.players) {
      this.playerStates.set(userId, {
        userId,
        nickname: player.nickname,
        avatar: player.avatar,
        score: 0,
        wordsTyped: 0,
        totalErrors: 0,
        wpm: 0,
        peakWpm: 0,
        accuracy: 100,
        level: 1,
        wpmTimeline: [],
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

        // Set match timer for survival mode
        if (this.settings.mode !== 'CAMPAIGN') {
          this.matchTimer = setTimeout(() => {
            this.endMatch();
          }, this.settings.matchDuration * 1000);
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
        state.wpm = data.wpm ?? state.wpm;
        state.accuracy = data.accuracy ?? state.accuracy;
        state.level = data.level ?? state.level;
        state.wordsTyped = data.wordsTyped ?? state.wordsTyped;
        if (data.wpm > state.peakWpm) state.peakWpm = data.wpm;

        // Broadcast progress to all
        this.emit('paperfall_player_progress', {
          userId: playerId,
          score: state.score,
          wpm: state.wpm,
          accuracy: state.accuracy,
          level: state.level,
          wordsTyped: state.wordsTyped,
        });
        break;
      }

      case 'word_typed': {
        state.wordsTyped = (state.wordsTyped || 0) + 1;
        state.score = data.score ?? state.score;
        break;
      }

      case 'finished': {
        state.status = 'FINISHED';
        state.finishedAt = Date.now();
        if (data.stats) {
          state.score = data.stats.score ?? state.score;
          state.wordsTyped = data.stats.wordsTyped ?? state.wordsTyped;
          state.totalErrors = data.stats.totalErrors ?? state.totalErrors;
          state.wpm = data.stats.avgWpm ?? state.wpm;
          state.peakWpm = Math.max(state.peakWpm, data.stats.peakWpm ?? 0);
          state.accuracy = data.stats.accuracy ?? state.accuracy;
          state.level = data.stats.levelReached ?? state.level;
          state.wpmTimeline = data.stats.wpmTimeline ?? state.wpmTimeline;
          if (data.stats.victory) {
            state.victory = true;
          }
        }

        // Check if all players finished OR someone achieved victory in campaign mode
        let allFinished = true;
        for (const [, ps] of this.playerStates) {
          if (ps.status !== 'FINISHED') { allFinished = false; break; }
        }
        if (allFinished || (this.settings.mode === 'CAMPAIGN' && state.victory)) {
          this.endMatch();
        }
        break;
      }

      case 'return_to_lobby': {
        state.status = 'FINISHED';
        
        // Check if all players finished
        let allFinished = true;
        for (const [, ps] of this.playerStates) {
          if (ps.status !== 'FINISHED') { allFinished = false; break; }
        }
        if (allFinished) {
          this.endMatch();
        }
        break;
      }

      default:
        break;
    }
  }

  endMatch() {
    if (this.status === 'FINISHED') return; // Already ended
    this.status = 'FINISHED';

    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    if (this.matchTimer) { clearTimeout(this.matchTimer); this.matchTimer = null; }

    // Compile results
    const results = [];
    for (const [userId, state] of this.playerStates) {
      results.push({
        userId: state.userId,
        nickname: state.nickname,
        avatar: state.avatar,
        rank: 0,
        score: state.score,
        wordsTyped: state.wordsTyped,
        totalErrors: state.totalErrors,
        avgWpm: state.wpm,
        peakWpm: state.peakWpm,
        accuracy: state.accuracy,
        levelReached: state.level,
        wpmTimeline: state.wpmTimeline,
        finishedAt: state.finishedAt,
      });
    }

    // Sort by score descending, assign ranks
    results.sort((a, b) => b.score - a.score);
    results.forEach((r, i) => { r.rank = i + 1; });

    this.results = results;
    this.emit('game_over', { gameId: this.gameId, results });
  }

  updateSettings(settings) {
    if (settings.difficulty) this.settings.difficulty = settings.difficulty;
    if (settings.matchDuration) this.settings.matchDuration = settings.matchDuration;
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
        wordsTyped: pState?.wordsTyped ?? 0,
        currentLevel: pState?.level ?? 1,
        wpm: pState?.wpm ?? 0,
        accuracy: pState?.accuracy ?? 100,
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

module.exports = PaperFallEngine;
