const BaseGameEngine = require('../engine/BaseGameEngine');
const GamePersistenceService = require('../services/GamePersistenceService');
const { getCardSymbols, calculateBoardDimensions, getPairCount } = require('./CardThemes');

class MemoryMatchEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'MEMORY_MATCH');
    this.board = [];          // Array of { index, symbol, isFlipped, isMatched }
    this.boardRows = 0;
    this.boardCols = 0;
    this.currentTurnPlayerId = null;
    this.firstFlip = null;    // { index } — the first card flipped this turn
    this.secondFlip = null;   // { index } — the second card flipped this turn
    this.scores = new Map();  // userId -> number
    this.winnerId = null;
    this.isDraw = false;
    this.historyLogs = [];
    this.totalPairs = 0;
    this.matchedPairs = 0;
    this.startTime = null;
    this.pendingMismatch = false; // Flag to prevent actions during mismatch reveal
  }

  startGame() {
    this.status = 'PLAYING';
    const playerIds = Array.from(this.players.keys());
    const count = playerIds.length;

    // Calculate board size based on settings or player count
    let pairCount = getPairCount(count);
    if (this.settings && this.settings.pairCount) {
      pairCount = parseInt(this.settings.pairCount, 10);
    }
    this.totalPairs = pairCount;
    this.matchedPairs = 0;
    const totalCards = pairCount * 2;

    // Get symbols and create pairs
    const symbols = getCardSymbols(pairCount);
    let cards = [];
    symbols.forEach(symbol => {
      cards.push(symbol, symbol); // Create pair
    });

    // Shuffle cards using Fisher-Yates
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }

    // Build board
    const { rows, cols } = calculateBoardDimensions(totalCards);
    this.boardRows = rows;
    this.boardCols = cols;
    this.board = cards.map((symbol, index) => ({
      index,
      symbol,
      isFlipped: false,
      isMatched: false,
      matchedBy: null, // userId of the player who matched this pair
    }));

    // Initialize scores
    playerIds.forEach(id => {
      this.scores.set(id, 0);
      const p = this.players.get(id);
      p.role = p.role || 'PLAYER';
    });

    // Set first turn
    this.currentTurnPlayerId = playerIds[0];
    this.firstFlip = null;
    this.secondFlip = null;
    this.winnerId = null;
    this.isDraw = false;
    this.startTime = Date.now();
    this.historyLogs = ['Game started. Find all matching pairs!'];

    this.persistState();
  }

  handlePlayerAction(playerId, action, data) {
    if (this.status === 'FINISHED') {
      return { success: false, error: 'Game already finished!' };
    }

    switch (action) {
      case 'flip_card':
        return this.flipCard(playerId, data.cardIndex);
      default:
        return { success: false, error: 'Unknown action!' };
    }
  }

  removePlayer(userId) {
    if (!this.players.has(userId)) return false;
    
    const wasCurrentTurn = (this.currentTurnPlayerId === userId);
    const playerIds = Array.from(this.players.keys());
    const idx = playerIds.indexOf(userId);
    
    this.players.delete(userId);
    
    if (wasCurrentTurn && this.players.size > 0) {
      // Pass turn to the next player
      let nextIdx = idx >= this.players.size ? 0 : idx;
      this.currentTurnPlayerId = Array.from(this.players.keys())[nextIdx];
    }

    if (this.players.size < 2 && this.status !== 'FINISHED') {
       this.endGame();
    }
    return true;
  }

  flipCard(playerId, cardIndex) {
    // Validate it's the current player's turn
    if (playerId !== this.currentTurnPlayerId) {
      return { success: false, error: 'Not your turn!' };
    }

    // Prevent actions during mismatch reveal
    if (this.pendingMismatch) {
      return { success: false, error: 'Wait for cards to flip back!' };
    }

    // Validate card index
    if (cardIndex < 0 || cardIndex >= this.board.length) {
      return { success: false, error: 'Invalid card index!' };
    }

    const card = this.board[cardIndex];

    // Can't flip already matched or already flipped cards
    if (card.isMatched) {
      return { success: false, error: 'Card already matched!' };
    }
    if (card.isFlipped) {
      return { success: false, error: 'Card already flipped!' };
    }

    const player = this.players.get(playerId);
    const playerName = player ? player.nickname : 'Unknown';

    // First flip of the turn
    if (!this.firstFlip) {
      card.isFlipped = true;
      this.firstFlip = { index: cardIndex };

      // Record move
      GamePersistenceService.recordMove(this.gameId, playerId, 'FLIP_CARD', { cardIndex, flip: 1 }).catch(console.error);
      this.persistState();

      return { success: true };
    }

    // Second flip of the turn
    card.isFlipped = true;
    this.secondFlip = { index: cardIndex };

    const firstCard = this.board[this.firstFlip.index];
    const secondCard = this.board[this.secondFlip.index];

    // Record move
    GamePersistenceService.recordMove(this.gameId, playerId, 'FLIP_CARD', { cardIndex, flip: 2 }).catch(console.error);

    // Check for match
    if (firstCard.symbol === secondCard.symbol) {
      // MATCH!
      firstCard.isMatched = true;
      secondCard.isMatched = true;
      firstCard.matchedBy = playerId;
      secondCard.matchedBy = playerId;
      this.matchedPairs++;

      const currentScore = (this.scores.get(playerId) || 0) + 1;
      this.scores.set(playerId, currentScore);

      this.historyLogs.push(`${playerName} found a match! (${firstCard.symbol}) Score: ${currentScore}`);

      // Reset flips — same player continues
      this.firstFlip = null;
      this.secondFlip = null;

      // Check if game is over
      if (this.matchedPairs >= this.totalPairs) {
        this.endGame();
      }

      this.persistState();
      return {
        success: true,
        broadcastEvent: {
          type: 'memory_match_result',
          data: {
            isMatch: true,
            cardIndex1: firstCard.index,
            cardIndex2: secondCard.index,
            symbol: firstCard.symbol,
            playerId,
            playerName,
            newScore: currentScore,
          }
        }
      };
    } else {
      // NO MATCH — cards will be flipped back after a delay
      this.pendingMismatch = true;

      this.historyLogs.push(`${playerName} flipped ${firstCard.symbol} and ${secondCard.symbol} — no match!`);

      const flipBackIndex1 = this.firstFlip.index;
      const flipBackIndex2 = this.secondFlip.index;

      // Schedule flip-back after 1.5 seconds
      setTimeout(() => {
        this.board[flipBackIndex1].isFlipped = false;
        this.board[flipBackIndex2].isFlipped = false;
        this.firstFlip = null;
        this.secondFlip = null;
        this.pendingMismatch = false;

        // Advance turn to next online player
        this.advanceTurn();
        this.persistState();

        // We need to trigger a state broadcast — store a callback
        if (this._broadcastCallback) {
          this._broadcastCallback();
        }
      }, 1500);

      this.persistState();
      return {
        success: true,
        broadcastEvent: {
          type: 'memory_match_result',
          data: {
            isMatch: false,
            cardIndex1: firstCard.index,
            cardIndex2: secondCard.index,
            symbol1: firstCard.symbol,
            symbol2: secondCard.symbol,
            playerId,
            playerName,
            flipBackDelay: 1500,
          }
        }
      };
    }
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
    this.status = 'FINISHED';

    // Find winner(s)
    let maxScore = 0;
    let winners = [];

    this.scores.forEach((score, playerId) => {
      // Ignore players who have left the game
      if (!this.players.has(playerId)) return;

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
      this.historyLogs.push(`${winnerPlayer.nickname} wins with ${maxScore} pairs!`);
    } else if (winners.length > 1) {
      this.winnerId = null;
      this.isDraw = true;
      const winnerNames = winners.map(id => this.players.get(id).nickname).join(', ');
      this.historyLogs.push(`It's a draw! ${winnerNames} tied with ${maxScore} pairs each!`);
    } else {
      this.winnerId = null;
      this.isDraw = true;
      this.historyLogs.push(`Game ended because all players left.`);
    }

    const durationSeconds = Math.floor((Date.now() - (this.startTime || Date.now())) / 1000);
    GamePersistenceService.recordResult(this.gameId, this.winnerId, durationSeconds).catch(console.error);
    this.persistState();
  }

  validateAction(playerId, action, data) {
    if (action === 'flip_card') {
      return playerId === this.currentTurnPlayerId && !this.pendingMismatch;
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

    // Build visible board — only show symbols for flipped or matched cards
    const visibleBoard = this.board.map(card => ({
      index: card.index,
      symbol: (card.isFlipped || card.isMatched) ? card.symbol : null,
      isFlipped: card.isFlipped,
      isMatched: card.isMatched,
      matchedBy: card.matchedBy || null,
    }));

    return {
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      board: visibleBoard,
      boardRows: this.boardRows,
      boardCols: this.boardCols,
      currentTurnPlayerId: this.currentTurnPlayerId,
      players: playersList,
      winnerId: this.winnerId,
      isDraw: this.isDraw,
      totalPairs: this.totalPairs,
      matchedPairs: this.matchedPairs,
      historyLogs: this.historyLogs.slice(-20), // Last 20 log entries
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
      board: this.board,
      boardRows: this.boardRows,
      boardCols: this.boardCols,
      currentTurnPlayerId: this.currentTurnPlayerId,
      firstFlip: this.firstFlip,
      secondFlip: this.secondFlip,
      scores: scoresObj,
      winnerId: this.winnerId,
      isDraw: this.isDraw,
      totalPairs: this.totalPairs,
      matchedPairs: this.matchedPairs,
      historyLogs: this.historyLogs,
      startTime: this.startTime,
      players: playersArr,
    };

    GamePersistenceService.saveSessionState(this.gameId, fullState, this.status).catch(console.error);
  }

  restoreState(state) {
    this.board = state.board || [];
    this.boardRows = state.boardRows || 0;
    this.boardCols = state.boardCols || 0;
    this.currentTurnPlayerId = state.currentTurnPlayerId || null;
    this.firstFlip = state.firstFlip || null;
    this.secondFlip = state.secondFlip || null;
    this.winnerId = state.winnerId || null;
    this.isDraw = state.isDraw || false;
    this.totalPairs = state.totalPairs || 0;
    this.matchedPairs = state.matchedPairs || 0;
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
          hand: [], // No hand in memory match but BaseGameEngine expects it
        });
      });
    }

    this.persistState();
  }
}

module.exports = MemoryMatchEngine;
