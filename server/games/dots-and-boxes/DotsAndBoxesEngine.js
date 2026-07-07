const BaseGameEngine = require('../engine/BaseGameEngine');
const GamePersistenceService = require('../services/GamePersistenceService');

class DotsAndBoxesEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'DOTS_AND_BOXES');
    this.settings = {
      boardSize: 5,  // Default 5x5 dots
      turnTimer: 30, // Default 30 seconds
      maxPlayers: 8,
    };
    this.boardSize = 5; // dots count: boardSize x boardSize
    this.hLines = [];   // 2D array: boardSize x (boardSize - 1)
    this.vLines = [];   // 2D array: (boardSize - 1) x boardSize
    this.boxes = [];    // 2D array: (boardSize - 1) x (boardSize - 1)
    this.currentTurnPlayerId = null;
    this.scores = new Map(); // userId -> score (number of boxes captured)
    this.winnerId = null;
    this.isDraw = false;
    this.historyLogs = [];
    this.startTime = null;
    
    // Timer state
    this.turnTimeLeft = 30;
    this.timerIntervalId = null;
  }

  startGame() {
    this.status = 'PLAYING';
    const playerIds = Array.from(this.players.keys());
    
    // Set board parameters based on settings
    this.boardSize = this.settings.boardSize || 5;
    this.turnTimeLeft = this.settings.turnTimer || 30;
    
    const R = this.boardSize;
    const C = this.boardSize;

    // Initialize lines
    this.hLines = Array.from({ length: R }, () => Array(C - 1).fill(null));
    this.vLines = Array.from({ length: R - 1 }, () => Array(C).fill(null));
    this.boxes = Array.from({ length: R - 1 }, () => Array(C - 1).fill(null));

    // Initialize scores
    playerIds.forEach(id => {
      this.scores.set(id, 0);
      const p = this.players.get(id);
      p.role = p.role || 'PLAYER';
    });

    // First player turn
    this.currentTurnPlayerId = playerIds[0];
    this.winnerId = null;
    this.isDraw = false;
    this.startTime = Date.now();
    this.historyLogs = [`Game started on a ${R}x${C} dots grid.`];

    // Start turn timer
    this.startTurnTimer();

    this.persistState();
  }

  startTurnTimer() {
    this.clearTurnTimer();
    this.turnTimeLeft = this.settings.turnTimer || 30;

    this.timerIntervalId = setInterval(() => {
      this.turnTimeLeft--;
      
      // Notify active listeners about timer update
      if (this._broadcastCallback) {
        this._broadcastCallback();
      }

      if (this.turnTimeLeft <= 0) {
        this.clearTurnTimer();
        this.handleTimeout();
      }
    }, 1000);
  }

  clearTurnTimer() {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  handleTimeout() {
    if (this.status !== 'PLAYING') return;

    // Active player ran out of time! Make a random valid move for them
    const validMoves = [];
    const R = this.boardSize;

    // Collect all unclaimed horizontal lines
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < R - 1; c++) {
        if (this.hLines[r][c] === null) {
          validMoves.push({ type: 'H', r, c });
        }
      }
    }

    // Collect all unclaimed vertical lines
    for (let r = 0; r < R - 1; r++) {
      for (let c = 0; c < R; c++) {
        if (this.vLines[r][c] === null) {
          validMoves.push({ type: 'V', r, c });
        }
      }
    }

    if (validMoves.length > 0) {
      const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      const player = this.players.get(this.currentTurnPlayerId);
      const nickname = player ? player.nickname : 'System';
      this.historyLogs.push(`${nickname} ran out of time! System made a move.`);
      
      // Execute the move
      this.drawLineAction(this.currentTurnPlayerId, randomMove.type, randomMove.r, randomMove.c, true);
    }
  }

  handlePlayerAction(playerId, action, data) {
    if (this.status === 'FINISHED') {
      return { success: false, error: 'Game already finished!' };
    }

    switch (action) {
      case 'draw_line':
        return this.drawLineAction(playerId, data.type, data.r, data.c);
      default:
        return { success: false, error: 'Unknown action!' };
    }
  }

  drawLineAction(playerId, type, r, c, isAuto = false) {
    // Validate turn
    if (playerId !== this.currentTurnPlayerId) {
      return { success: false, error: 'Not your turn!' };
    }

    // Validate type and coordinates
    const R = this.boardSize;
    if (type === 'H') {
      if (r < 0 || r >= R || c < 0 || c >= R - 1) {
        return { success: false, error: 'Invalid coordinates for horizontal line.' };
      }
      if (this.hLines[r][c] !== null) {
        return { success: false, error: 'Line already drawn.' };
      }
      this.hLines[r][c] = playerId;
    } else if (type === 'V') {
      if (r < 0 || r >= R - 1 || c < 0 || c >= R) {
        return { success: false, error: 'Invalid coordinates for vertical line.' };
      }
      if (this.vLines[r][c] !== null) {
        return { success: false, error: 'Line already drawn.' };
      }
      this.vLines[r][c] = playerId;
    } else {
      return { success: false, error: 'Invalid line type.' };
    }

    const player = this.players.get(playerId);
    const nickname = player ? player.nickname : 'Unknown';

    // Record the move in database
    GamePersistenceService.recordMove(this.gameId, playerId, 'DRAW_LINE', { type, r, c, isAuto }).catch(console.error);

    // Check if any box gets completed
    const completedBoxes = [];
    const checkedBoxes = []; // list of { r, c } boxes we need to check

    if (type === 'H') {
      if (r > 0) checkedBoxes.push({ br: r - 1, bc: c }); // Box above
      if (r < R - 1) checkedBoxes.push({ br: r, bc: c }); // Box below
    } else {
      if (c > 0) checkedBoxes.push({ br: r, bc: c - 1 }); // Box to the left
      if (c < R - 1) checkedBoxes.push({ br: r, bc: c }); // Box to the right
    }

    let boxesCapturedThisTurn = 0;

    checkedBoxes.forEach(({ br, bc }) => {
      // Check if all 4 sides are drawn
      const top = this.hLines[br][bc];
      const bottom = this.hLines[br + 1][bc];
      const left = this.vLines[br][bc];
      const right = this.vLines[br][bc + 1];

      if (top !== null && bottom !== null && left !== null && right !== null) {
        if (this.boxes[br][bc] === null) {
          this.boxes[br][bc] = playerId;
          boxesCapturedThisTurn++;
          completedBoxes.push({ r: br, c: bc });
        }
      }
    });

    if (boxesCapturedThisTurn > 0) {
      const currentScore = (this.scores.get(playerId) || 0) + boxesCapturedThisTurn;
      this.scores.set(playerId, currentScore);
      this.historyLogs.push(`${nickname} completed ${boxesCapturedThisTurn} box(es)! (Total: ${currentScore})`);

      // Check if board is complete
      const totalBoxes = (R - 1) * (R - 1);
      let capturedCount = 0;
      for (let i = 0; i < R - 1; i++) {
        for (let j = 0; j < R - 1; j++) {
          if (this.boxes[i][j] !== null) capturedCount++;
        }
      }

      if (capturedCount >= totalBoxes) {
        this.endGame();
      } else {
        // Player gets to take another turn! Reset timer
        this.startTurnTimer();
      }
    } else {
      // No boxes captured — advance turn to next player
      this.clearTurnTimer();
      this.advanceTurn();
      this.startTurnTimer();
    }

    this.persistState();

    // Trigger state update callback
    if (this._broadcastCallback) {
      this._broadcastCallback();
    }

    return {
      success: true,
      broadcastEvent: {
        type: 'dots_and_boxes_result',
        data: {
          type,
          r,
          c,
          playerId,
          completedBoxes,
        }
      }
    };
  }

  advanceTurn() {
    const playerIds = Array.from(this.players.keys());
    const currentIdx = playerIds.indexOf(this.currentTurnPlayerId);
    let safety = 0;
    let nextIdx = currentIdx;

    do {
      nextIdx = (nextIdx + 1) % playerIds.length;
      safety++;
    } while (!this.players.get(playerIds[nextIdx]).isOnline && safety < playerIds.length);

    this.currentTurnPlayerId = playerIds[nextIdx];
  }

  endGame() {
    this.clearTurnTimer();
    this.status = 'FINISHED';

    let maxScore = -1;
    let winners = [];

    this.scores.forEach((score, playerId) => {
      if (score > maxScore) {
        maxScore = score;
        winners = [playerId];
      } else if (score === maxScore) {
        winners.push(playerId);
      }
    });

    if (winners.length === 1) {
      this.winnerId = winners[0];
      this.isDraw = false;
      const winnerPlayer = this.players.get(this.winnerId);
      this.historyLogs.push(`${winnerPlayer.nickname} wins with ${maxScore} boxes captured!`);
    } else {
      this.winnerId = null;
      this.isDraw = true;
      const winnerNicknames = winners.map(id => this.players.get(id).nickname).join(', ');
      this.historyLogs.push(`It's a draw! ${winnerNicknames} tied with ${maxScore} boxes each.`);
    }

    const durationSeconds = Math.floor((Date.now() - (this.startTime || Date.now())) / 1000);
    GamePersistenceService.recordResult(this.gameId, this.winnerId, durationSeconds).catch(console.error);
    this.persistState();
  }

  validateAction(playerId, action, data) {
    if (action === 'draw_line') {
      return playerId === this.currentTurnPlayerId;
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
        score: this.scores.get(id) || 0,
      });
    });

    return {
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      boardSize: this.boardSize,
      hLines: this.hLines,
      vLines: this.vLines,
      boxes: this.boxes,
      currentTurnPlayerId: this.currentTurnPlayerId,
      turnTimeLeft: this.turnTimeLeft,
      players: playersList,
      winnerId: this.winnerId,
      isDraw: this.isDraw,
      historyLogs: this.historyLogs.slice(-20),
    };
  }

  persistState() {
    const playersArr = [];
    this.players.forEach((p) => {
      playersArr.push({
        userId: p.userId,
        nickname: p.nickname,
        role: p.role,
        isReady: p.isReady,
        isOnline: p.isOnline,
      });
    });

    const scoresObj = {};
    this.scores.forEach((score, id) => {
      scoresObj[id] = score;
    });

    const fullState = {
      settings: this.settings,
      boardSize: this.boardSize,
      hLines: this.hLines,
      vLines: this.vLines,
      boxes: this.boxes,
      currentTurnPlayerId: this.currentTurnPlayerId,
      scores: scoresObj,
      winnerId: this.winnerId,
      isDraw: this.isDraw,
      historyLogs: this.historyLogs,
      startTime: this.startTime,
      players: playersArr,
    };

    GamePersistenceService.saveSessionState(this.gameId, fullState, this.status).catch(console.error);
  }

  restoreState(state) {
    this.settings = state.settings || { boardSize: 5, turnTimer: 30 };
    this.boardSize = state.boardSize || 5;
    this.hLines = state.hLines || [];
    this.vLines = state.vLines || [];
    this.boxes = state.boxes || [];
    this.currentTurnPlayerId = state.currentTurnPlayerId || null;
    this.winnerId = state.winnerId || null;
    this.isDraw = state.isDraw || false;
    this.historyLogs = state.historyLogs || [];
    this.startTime = state.startTime || null;

    // Restore scores
    this.scores = new Map();
    if (state.scores) {
      Object.entries(state.scores).forEach(([id, score]) => {
        this.scores.set(id, score);
      });
    }

    // Restore players
    if (state.players && Array.isArray(state.players)) {
      state.players.forEach((p) => {
        this.players.set(p.userId, {
          userId: p.userId,
          nickname: p.nickname,
          role: p.role,
          isReady: p.isReady,
          isOnline: p.isOnline,
          hand: [],
        });
      });
    }

    // Resume turn timer if playing
    if (this.status === 'PLAYING') {
      this.startTurnTimer();
    }

    this.persistState();
  }
}

module.exports = DotsAndBoxesEngine;
