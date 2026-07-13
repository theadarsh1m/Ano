const BaseGameEngine = require('../engine/BaseGameEngine');
const GamePersistenceService = require('../services/GamePersistenceService');
const {
  ALL_CATEGORIES,
  calculateScore,
  calculateAllPossible,
  isValidCategory,
  calculateUpperTotal,
  calculateLowerTotal,
  calculateBonus,
  calculateGrandTotal,
  isScoreSheetComplete,
  createEmptyScoreSheet,
  CATEGORY_DISPLAY_NAMES,
  DEFAULT_BONUS_THRESHOLD,
} = require('./YatzyScoring');

class YatzyEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'YATZY');
    this.dice = [0, 0, 0, 0, 0];       // 5 dice values (1-6)
    this.heldDice = [false, false, false, false, false]; // which dice are held
    this.rollsLeft = 0;                   // remaining rolls this turn
    this.scoreSheets = new Map();         // userId -> { [category]: number | null }
    this.currentTurnPlayerId = null;
    this.currentRound = 1;
    this.totalRounds = 13;                // 13 categories to fill
    this.winnerId = null;
    this.isDraw = false;
    this.historyLogs = [];
    this.startTime = null;
    this.bonusThreshold = DEFAULT_BONUS_THRESHOLD;
    this.hasRolled = false;               // whether the current player has rolled at least once
  }

  startGame() {
    this.status = 'PLAYING';
    const playerIds = Array.from(this.players.keys());

    // Read bonus threshold from lobby settings
    if (this.settings && this.settings.bonusThreshold) {
      this.bonusThreshold = parseInt(this.settings.bonusThreshold, 10);
    }

    // Initialize score sheets
    playerIds.forEach(id => {
      this.scoreSheets.set(id, createEmptyScoreSheet());
      const p = this.players.get(id);
      p.role = p.role || 'PLAYER';
    });

    // Set first turn
    this.currentTurnPlayerId = playerIds[0];
    this.currentRound = 1;
    this.winnerId = null;
    this.isDraw = false;
    this.startTime = Date.now();
    this.historyLogs = ['Game started! Roll the dice!'];

    // Auto-roll for first player
    this._autoRoll();

    this.persistState();
  }

  handlePlayerAction(playerId, action, data) {
    if (this.status === 'FINISHED') {
      return { success: false, error: 'Game already finished!' };
    }

    switch (action) {
      case 'roll_dice':
        return this._rollDice(playerId);
      case 'hold_dice':
        return this._holdDice(playerId, data.diceIndex);
      case 'select_category':
        return this._selectCategory(playerId, data.category);
      default:
        return { success: false, error: 'Unknown action!' };
    }
  }

  _autoRoll() {
    // Roll all 5 dice, set rollsLeft to 2
    this.heldDice = [false, false, false, false, false];
    this.dice = this.dice.map(() => Math.floor(Math.random() * 6) + 1);
    this.rollsLeft = 2;
    this.hasRolled = true;
  }

  _rollDice(playerId) {
    if (playerId !== this.currentTurnPlayerId) {
      return { success: false, error: 'Not your turn!' };
    }
    if (this.rollsLeft <= 0) {
      return { success: false, error: 'No rolls remaining! Select a category.' };
    }

    // Roll only unheld dice
    this.dice = this.dice.map((val, i) => {
      if (this.heldDice[i]) return val;
      return Math.floor(Math.random() * 6) + 1;
    });
    this.rollsLeft--;
    this.hasRolled = true;

    const player = this.players.get(playerId);
    this.historyLogs.push(`${player.nickname} rolled: [${this.dice.join(', ')}] (${this.rollsLeft} rolls left)`);

    GamePersistenceService.recordMove(this.gameId, playerId, 'ROLL_DICE', { dice: [...this.dice], rollsLeft: this.rollsLeft }).catch(console.error);
    this.persistState();

    return {
      success: true,
      broadcastEvent: {
        type: 'yatzy_roll',
        data: { dice: [...this.dice], rollsLeft: this.rollsLeft, playerId }
      }
    };
  }

  _holdDice(playerId, diceIndex) {
    if (playerId !== this.currentTurnPlayerId) {
      return { success: false, error: 'Not your turn!' };
    }
    if (!this.hasRolled) {
      return { success: false, error: 'Roll first before holding dice!' };
    }
    if (this.rollsLeft <= 0) {
      return { success: false, error: 'No rolls left. Select a category.' };
    }
    if (diceIndex < 0 || diceIndex >= 5) {
      return { success: false, error: 'Invalid dice index!' };
    }

    this.heldDice[diceIndex] = !this.heldDice[diceIndex];
    this.persistState();

    return { success: true };
  }

  _selectCategory(playerId, category) {
    if (playerId !== this.currentTurnPlayerId) {
      return { success: false, error: 'Not your turn!' };
    }
    if (!this.hasRolled) {
      return { success: false, error: 'You must roll at least once!' };
    }
    if (!isValidCategory(category)) {
      return { success: false, error: 'Invalid scoring category!' };
    }

    const sheet = this.scoreSheets.get(playerId);
    if (sheet[category] !== null) {
      return { success: false, error: 'Category already used!' };
    }

    // Calculate and lock score
    const score = calculateScore(this.dice, category);
    sheet[category] = score;

    const player = this.players.get(playerId);
    const displayName = CATEGORY_DISPLAY_NAMES[category] || category;
    this.historyLogs.push(`${player.nickname} scored ${score} in ${displayName}`);

    // Check for Yatzy bonus log
    if (category === 'yatzy' && score === 50) {
      this.historyLogs.push(`🎲 ${player.nickname} got a YATZY! 50 points!`);
    }

    // Check if upper bonus was just achieved
    const upperTotal = calculateUpperTotal(sheet);
    if (upperTotal >= this.bonusThreshold) {
      const prevUpperTotal = upperTotal - (category.startsWith('ones') || category.startsWith('twos') ||
        category.startsWith('threes') || category.startsWith('fours') ||
        category.startsWith('fives') || category.startsWith('sixes') ? score : 0);
      if (prevUpperTotal < this.bonusThreshold) {
        this.historyLogs.push(`🌟 ${player.nickname} earned the upper section bonus! +50`);
      }
    }

    GamePersistenceService.recordMove(this.gameId, playerId, 'SELECT_CATEGORY', { category, score, dice: [...this.dice] }).catch(console.error);

    // Advance turn
    this._advanceTurn();

    return {
      success: true,
      broadcastEvent: {
        type: 'yatzy_score',
        data: { playerId, category, score }
      }
    };
  }

  _advanceTurn() {
    const playerIds = Array.from(this.players.keys());
    const currentIdx = playerIds.indexOf(this.currentTurnPlayerId);

    // Find next online player
    let nextIdx = currentIdx;
    let safety = 0;
    do {
      nextIdx = (nextIdx + 1) % playerIds.length;
      safety++;
    } while (!this.players.get(playerIds[nextIdx]).isOnline && safety < playerIds.length);

    // Check if we've wrapped around (new round)
    if (nextIdx <= currentIdx || safety >= playerIds.length) {
      this.currentRound++;
    }

    // Check if all players have completed all categories
    let allComplete = true;
    for (const [id, sheet] of this.scoreSheets) {
      if (this.players.has(id) && !isScoreSheetComplete(sheet)) {
        allComplete = false;
        break;
      }
    }

    if (allComplete || this.currentRound > this.totalRounds) {
      this.endGame();
      return;
    }

    // Set next turn
    this.currentTurnPlayerId = playerIds[nextIdx];
    this.dice = [0, 0, 0, 0, 0];
    this.heldDice = [false, false, false, false, false];
    this.rollsLeft = 3;
    this.hasRolled = false;

    // Auto-roll for next player
    this._autoRoll();

    this.persistState();
  }

  removePlayer(userId) {
    if (!this.players.has(userId)) return false;

    const wasCurrentTurn = (this.currentTurnPlayerId === userId);
    const playerIds = Array.from(this.players.keys());
    const idx = playerIds.indexOf(userId);

    this.players.delete(userId);

    if (this.players.size < 2 && this.status !== 'FINISHED') {
      this.endGame();
      return true;
    }

    if (wasCurrentTurn && this.players.size > 0) {
      let nextIdx = idx >= this.players.size ? 0 : idx;
      this.currentTurnPlayerId = Array.from(this.players.keys())[nextIdx];
      this.dice = [0, 0, 0, 0, 0];
      this.heldDice = [false, false, false, false, false];
      this.rollsLeft = 3;
      this.hasRolled = false;
      this._autoRoll();
    }

    return true;
  }

  endGame() {
    this.status = 'FINISHED';

    let maxScore = -1;
    let winners = [];

    for (const [playerId] of this.players) {
      const sheet = this.scoreSheets.get(playerId);
      if (!sheet) continue;
      const total = calculateGrandTotal(sheet, this.bonusThreshold);
      if (total > maxScore) {
        maxScore = total;
        winners = [playerId];
      } else if (total === maxScore) {
        winners.push(playerId);
      }
    }

    if (winners.length === 1) {
      this.winnerId = winners[0];
      this.isDraw = false;
      const winnerPlayer = this.players.get(this.winnerId);
      if (winnerPlayer) {
        this.historyLogs.push(`🏆 ${winnerPlayer.nickname} wins with ${maxScore} points!`);
      }
    } else if (winners.length > 1) {
      this.winnerId = null;
      this.isDraw = true;
      const winnerNames = winners.map(id => this.players.get(id)?.nickname || 'Unknown').join(', ');
      this.historyLogs.push(`It's a draw! ${winnerNames} tied with ${maxScore} points each!`);
    } else {
      this.winnerId = null;
      this.isDraw = true;
      this.historyLogs.push('Game ended because all players left.');
    }

    const durationSeconds = Math.floor((Date.now() - (this.startTime || Date.now())) / 1000);
    GamePersistenceService.recordResult(this.gameId, this.winnerId, durationSeconds).catch(console.error);
    this.persistState();
  }

  validateAction(playerId, action, data) {
    switch (action) {
      case 'roll_dice':
        return playerId === this.currentTurnPlayerId && this.rollsLeft > 0;
      case 'hold_dice':
        return playerId === this.currentTurnPlayerId && this.hasRolled && this.rollsLeft > 0;
      case 'select_category':
        return playerId === this.currentTurnPlayerId && this.hasRolled && isValidCategory(data?.category);
      default:
        return false;
    }
  }

  serializeState(privatePlayerId) {
    const playersList = [];
    this.players.forEach((p, id) => {
      const sheet = this.scoreSheets.get(id) || createEmptyScoreSheet();
      const upperTotal = calculateUpperTotal(sheet);
      const bonus = calculateBonus(sheet, this.bonusThreshold);
      const lowerTotal = calculateLowerTotal(sheet);
      const grandTotal = calculateGrandTotal(sheet, this.bonusThreshold);

      playersList.push({
        userId: p.userId,
        nickname: p.nickname,
        role: p.role,
        isReady: p.isReady,
        isOnline: p.isOnline,
        scoreSheet: sheet,
        upperTotal,
        bonus,
        lowerTotal,
        grandTotal,
      });
    });

    // Calculate possible scores for the current turn player
    let possibleScores = null;
    if (this.hasRolled && this.status === 'PLAYING') {
      possibleScores = calculateAllPossible(this.dice);
    }

    return {
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      dice: [...this.dice],
      heldDice: [...this.heldDice],
      rollsLeft: this.rollsLeft,
      hasRolled: this.hasRolled,
      currentTurnPlayerId: this.currentTurnPlayerId,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      bonusThreshold: this.bonusThreshold,
      players: playersList,
      possibleScores,
      winnerId: this.winnerId,
      isDraw: this.isDraw,
      historyLogs: this.historyLogs.slice(-30),
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

    const scoreSheetsObj = {};
    this.scoreSheets.forEach((sheet, id) => {
      scoreSheetsObj[id] = sheet;
    });

    const fullState = {
      dice: this.dice,
      heldDice: this.heldDice,
      rollsLeft: this.rollsLeft,
      hasRolled: this.hasRolled,
      scoreSheets: scoreSheetsObj,
      currentTurnPlayerId: this.currentTurnPlayerId,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      bonusThreshold: this.bonusThreshold,
      winnerId: this.winnerId,
      isDraw: this.isDraw,
      historyLogs: this.historyLogs,
      startTime: this.startTime,
      players: playersArr,
    };

    GamePersistenceService.saveSessionState(this.gameId, fullState, this.status).catch(console.error);
  }

  restoreState(state) {
    this.dice = state.dice || [0, 0, 0, 0, 0];
    this.heldDice = state.heldDice || [false, false, false, false, false];
    this.rollsLeft = state.rollsLeft || 0;
    this.hasRolled = state.hasRolled || false;
    this.currentTurnPlayerId = state.currentTurnPlayerId || null;
    this.currentRound = state.currentRound || 1;
    this.totalRounds = state.totalRounds || 13;
    this.bonusThreshold = state.bonusThreshold || DEFAULT_BONUS_THRESHOLD;
    this.winnerId = state.winnerId || null;
    this.isDraw = state.isDraw || false;
    this.historyLogs = state.historyLogs || [];
    this.startTime = state.startTime || null;

    // Restore score sheets
    this.scoreSheets = new Map();
    if (state.scoreSheets) {
      Object.entries(state.scoreSheets).forEach(([id, sheet]) => {
        this.scoreSheets.set(id, sheet);
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

    this.persistState();
  }
}

module.exports = YatzyEngine;
