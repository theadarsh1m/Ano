const BaseGameEngine = require('../engine/BaseGameEngine');
const GamePersistenceService = require('../services/GamePersistenceService');

class ColorWarsEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'COLOR_WARS');
    this.settings = {
      boardSize: 7,  // Default 7x7
      turnTimer: 30, // Default 30 seconds
      maxPlayers: 8,
    };
    this.boardSize = 7;
    this.grid = []; // 2D array: boardSize x boardSize
    this.currentTurnPlayerId = null;
    this.hasTakenTurn = new Map(); // userId -> boolean
    this.eliminatedPlayers = new Set(); // Set of userIds
    this.playerColors = new Map(); // userId -> color string
    this.winnerId = null;
    this.isDraw = false;
    this.historyLogs = [];
    this.startTime = null;
    this.turnTimeLeft = 30;
    this.timerIntervalId = null;
  }

  getCapacity(r, c, R) {
    const isRowEdge = (r === 0 || r === R - 1);
    const isColEdge = (c === 0 || c === R - 1);
    if (isRowEdge && isColEdge) {
      return 2; // Corner
    } else if (isRowEdge || isColEdge) {
      return 3; // Edge
    }
    return 4; // Center
  }

  getStartingPositions(R, numPlayers) {
    // Return evenly distributed starting positions
    const corners = [
      { r: 0, c: 0 },
      { r: R - 1, c: R - 1 },
      { r: 0, c: R - 1 },
      { r: R - 1, c: 0 }
    ];
    const midEdges = [
      { r: 0, c: Math.floor(R / 2) },
      { r: R - 1, c: Math.floor(R / 2) },
      { r: Math.floor(R / 2), c: 0 },
      { r: Math.floor(R / 2), c: R - 1 }
    ];

    const allPositions = [...corners, ...midEdges];
    return allPositions.slice(0, numPlayers);
  }

  startGame() {
    this.status = 'PLAYING';
    const playerIds = Array.from(this.players.keys());
    this.boardSize = this.settings.boardSize || 7;
    this.turnTimeLeft = this.settings.turnTimer || 30;

    const R = this.boardSize;

    // 1. Initialize grid (all empty)
    this.grid = Array.from({ length: R }, (_, r) => 
      Array.from({ length: R }, (_, c) => ({
        ownerId: null,
        level: 0,
        capacity: this.getCapacity(r, c, R)
      }))
    );

    // 2. Assign Player Colors
    const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];
    playerIds.forEach((id, index) => {
      this.playerColors.set(id, COLORS[index % COLORS.length]);
      this.hasTakenTurn.set(id, false);
      const p = this.players.get(id);
      p.role = p.role || 'PLAYER';
    });

    // 3. Set Starting Player Randomly
    this.currentTurnPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)];
    this.winnerId = null;
    this.isDraw = false;
    this.startTime = Date.now();
    this.historyLogs = [`Color Wars started. Board is empty. player ${this.players.get(this.currentTurnPlayerId)?.nickname || '1'} starts.`];

    // 4. Start turn timer
    this.startTurnTimer();
    this.persistState();
  }

  startTurnTimer() {
    this.clearTurnTimer();
    this.turnTimeLeft = this.settings.turnTimer || 30;

    this.timerIntervalId = setInterval(() => {
      this.turnTimeLeft--;

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

    // Auto-play a random valid move for the active player
    const validMoves = [];
    const R = this.boardSize;

    for (let r = 0; r < R; r++) {
      for (let c = 0; c < R; c++) {
        const owner = this.grid[r][c].ownerId;
        if (owner === null || owner === this.currentTurnPlayerId) {
          validMoves.push({ r, c });
        }
      }
    }

    if (validMoves.length > 0) {
      const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      const player = this.players.get(this.currentTurnPlayerId);
      const nickname = player ? player.nickname : 'System';
      this.historyLogs.push(`${nickname} ran out of time! System placed energy automatically.`);
      this.selectTileAction(this.currentTurnPlayerId, randomMove.r, randomMove.c);
    }
  }

  removePlayer(userId) {
    if (!this.players.has(userId)) return false;

    const wasCurrentTurn = (this.currentTurnPlayerId === userId);
    const playerIds = Array.from(this.players.keys());
    const idx = playerIds.indexOf(userId);

    this.players.delete(userId);

    if (wasCurrentTurn && this.players.size > 0) {
      this.clearTurnTimer();
      this.advanceTurn();
      if (this.status === 'PLAYING') {
        this.startTurnTimer();
      }
    }

    if (this.players.size < 2 && this.status !== 'FINISHED') {
      this.status = 'FINISHED';
      this.clearTurnTimer();
    }
    return true;
  }

  handlePlayerAction(playerId, action, data) {
    if (this.status === 'FINISHED') {
      return { success: false, error: 'Game already finished!' };
    }

    switch (action) {
      case 'select_tile':
        return this.selectTileAction(playerId, data.r, data.c);
      default:
        return { success: false, error: 'Unknown action!' };
    }
  }

  selectTileAction(playerId, r, c) {
    if (playerId !== this.currentTurnPlayerId) {
      return { success: false, error: 'Not your turn!' };
    }

    const R = this.boardSize;
    if (r < 0 || r >= R || c < 0 || c >= R) {
      return { success: false, error: 'Coordinates out of bounds.' };
    }

    const cell = this.grid[r][c];
    const isFirstTurn = !this.hasTakenTurn.get(playerId);

    if (isFirstTurn) {
      if (cell.ownerId !== null) {
        return { success: false, error: 'Your first move must be on an empty cell.' };
      }
      // First turn: place 3 orbs
      cell.level = 3;
      cell.ownerId = playerId;
    } else {
      if (cell.ownerId !== playerId) {
        return { success: false, error: 'You can only select your own cells on subsequent turns.' };
      }
      // Subsequent turns: increment by 1
      cell.level++;
    }

    // Record raw move
    GamePersistenceService.recordMove(this.gameId, playerId, 'SELECT_TILE', { r, c }).catch(console.error);

    const player = this.players.get(playerId);
    const nickname = player ? player.nickname : 'Unknown';
    this.historyLogs.push(`${nickname} placed energy at (${r + 1}, ${c + 1}) (Total: ${cell.level})`);

    const waves = [];
    let waveCount = 0;
    const maxWavesLimit = 800; // Safety cap to prevent infinite cascades

    while (waveCount < maxWavesLimit) {
      const overloaded = [];
      for (let i = 0; i < R; i++) {
        for (let j = 0; j < R; j++) {
          if (this.grid[i][j].level >= this.grid[i][j].capacity) {
            overloaded.push({ r: i, c: j });
          }
        }
      }

      if (overloaded.length === 0) {
        break; // Stabilized
      }

      const waveState = {
        explosions: overloaded,
        gridStateSnapshot: null
      };

      const distributionQueue = [];
      overloaded.forEach(({ r: er, c: ec }) => {
        const explodingCell = this.grid[er][ec];
        
        explodingCell.level = 0;
        explodingCell.ownerId = null;

        const neighbors = [
          { nr: er - 1, nc: ec },
          { nr: er + 1, nc: ec },
          { nr: er, nc: ec - 1 },
          { nr: er, nc: ec + 1 }
        ];

        neighbors.forEach(({ nr, nc }) => {
          if (nr >= 0 && nr < R && nc >= 0 && nc < R) {
            distributionQueue.push({ nr, nc });
          }
        });
      });

      // Apply distributions
      distributionQueue.forEach(({ nr, nc }) => {
        const target = this.grid[nr][nc];
        target.level++;
        target.ownerId = playerId; // Capturing neighbors
      });

      waveState.gridStateSnapshot = this.grid.map(row => row.map(cell => ({ ...cell })));
      waves.push(waveState);
      waveCount++;
    }

    // Mark turn complete
    this.hasTakenTurn.set(playerId, true);

    // Calculate tile ownership counts for elimination check
    const playerIds = Array.from(this.players.keys());
    const tileCounts = new Map();
    playerIds.forEach(id => tileCounts.set(id, 0));

    for (let i = 0; i < R; i++) {
      for (let j = 0; j < R; j++) {
        const owner = this.grid[i][j].ownerId;
        if (owner) {
          tileCounts.set(owner, (tileCounts.get(owner) || 0) + 1);
        }
      }
    }

    // Process player elimination
    playerIds.forEach(pId => {
      if (this.hasTakenTurn.get(pId) && tileCounts.get(pId) === 0 && !this.eliminatedPlayers.has(pId)) {
        this.eliminatedPlayers.add(pId);
        const p = this.players.get(pId);
        if (p) {
          p.role = 'SPECTATOR';
          this.historyLogs.push(`💀 ${p.nickname} has been eliminated!`);
        }
      }
    });

    // Check game finish conditions
    const activePlayersCount = playerIds.filter(pId => !this.eliminatedPlayers.has(pId));
    const playersWhoTookTurnCount = Array.from(this.hasTakenTurn.values()).filter(Boolean).length;

    // Victory check: Only 1 player remaining (after at least 2 players have initialized turns)
    if (activePlayersCount.length === 1 && playersWhoTookTurnCount >= 2) {
      this.winnerId = activePlayersCount[0];
      this.status = 'FINISHED';
      this.clearTurnTimer();
      const winnerPlayer = this.players.get(this.winnerId);
      if (winnerPlayer) {
        this.historyLogs.push(`🏆 Victory! ${winnerPlayer.nickname} wins the Color Wars!`);
      }
      
      const durationSeconds = Math.floor((Date.now() - (this.startTime || Date.now())) / 1000);
      GamePersistenceService.recordResult(this.gameId, this.winnerId, durationSeconds).catch(console.error);
    } else if (activePlayersCount.length === 0) {
      // Draw or ended
      this.status = 'FINISHED';
      this.clearTurnTimer();
      this.historyLogs.push('Game over. No active players remain.');
    } else {
      // Continue next turn
      this.clearTurnTimer();
      this.advanceTurn();
      this.startTurnTimer();
    }

    this.persistState();

    if (this._broadcastCallback) {
      this._broadcastCallback();
    }

    return {
      success: true,
      broadcastEvent: {
        type: 'color_wars_result',
        data: {
          playerId,
          initialCell: { r, c },
          waves,
        }
      }
    };
  }

  advanceTurn() {
    const playerIds = Array.from(this.players.keys());
    const currentIdx = playerIds.indexOf(this.currentTurnPlayerId);
    let nextIdx = currentIdx;
    let safety = 0;

    do {
      nextIdx = (nextIdx + 1) % playerIds.length;
      safety++;
    } while (
      (this.eliminatedPlayers.has(playerIds[nextIdx]) || 
       !this.players.get(playerIds[nextIdx]).isOnline) && 
      safety < playerIds.length
    );

    this.currentTurnPlayerId = playerIds[nextIdx];
  }

  serializeState(privatePlayerId) {
    const playersList = [];
    this.players.forEach((p, id) => {
      // Calculate tile count
      let tiles = 0;
      for (let i = 0; i < this.boardSize; i++) {
        for (let j = 0; j < this.boardSize; j++) {
          if (this.grid[i]?.[j]?.ownerId === id) {
            tiles++;
          }
        }
      }

      playersList.push({
        userId: p.userId,
        nickname: p.nickname,
        role: p.role,
        isReady: p.isReady,
        isOnline: p.isOnline,
        color: this.playerColors.get(id) || 'red',
        isEliminated: this.eliminatedPlayers.has(id),
        tileCount: tiles,
      });
    });

    return {
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      boardSize: this.boardSize,
      grid: this.grid,
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

    const colorsObj = {};
    this.playerColors.forEach((color, id) => {
      colorsObj[id] = color;
    });

    const hasTurnObj = {};
    this.hasTakenTurn.forEach((val, id) => {
      hasTurnObj[id] = val;
    });

    const fullState = {
      settings: this.settings,
      boardSize: this.boardSize,
      grid: this.grid,
      currentTurnPlayerId: this.currentTurnPlayerId,
      winnerId: this.winnerId,
      isDraw: this.isDraw,
      historyLogs: this.historyLogs,
      startTime: this.startTime,
      players: playersArr,
      playerColors: colorsObj,
      hasTakenTurn: hasTurnObj,
      eliminatedPlayers: Array.from(this.eliminatedPlayers),
    };

    GamePersistenceService.saveSessionState(this.gameId, fullState, this.status).catch(console.error);
  }

  restoreState(state) {
    this.settings = state.settings || { boardSize: 7, turnTimer: 30 };
    this.boardSize = state.boardSize || 7;
    this.grid = state.grid || [];
    this.currentTurnPlayerId = state.currentTurnPlayerId || null;
    this.winnerId = state.winnerId || null;
    this.isDraw = state.isDraw || false;
    this.historyLogs = state.historyLogs || [];
    this.startTime = state.startTime || null;

    this.playerColors = new Map();
    if (state.playerColors) {
      Object.entries(state.playerColors).forEach(([id, color]) => {
        this.playerColors.set(id, color);
      });
    }

    this.hasTakenTurn = new Map();
    if (state.hasTakenTurn) {
      Object.entries(state.hasTakenTurn).forEach(([id, val]) => {
        this.hasTakenTurn.set(id, val);
      });
    }

    this.eliminatedPlayers = new Set(state.eliminatedPlayers || []);

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

    if (this.status === 'PLAYING') {
      this.startTurnTimer();
    }

    this.persistState();
  }
}

module.exports = ColorWarsEngine;
