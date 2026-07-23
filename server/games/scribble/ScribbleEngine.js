const BaseGameEngine = require('../engine/BaseGameEngine');
const WordService = require('./WordService');

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}

class ScribbleEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'SCRIBBLE');
    this.settings = {
      rounds: 3,
      drawingTime: 60, // seconds
      wordChoices: 3,
      category: 'mixed' // default
    };
    
    // Game State
    this.currentRound = 0;
    this.totalRounds = 3;
    this.drawerQueue = []; // array of userIds
    this.currentDrawerIndex = 0;
    this.currentDrawerId = null;
    
    this.wordChoices = [];
    this.selectedWord = null;
    this.usedWords = []; // avoid repeating
    
    this.turnState = 'WAITING_FOR_WORD'; // WAITING_FOR_WORD, DRAWING, ROUND_END
    this.drawingTimeLeft = 0;
    this.timerIntervalId = null;
    
    this.scores = new Map(); // userId -> score
    this.guessStatus = new Map(); // userId -> { hasGuessed: boolean, pointsEarned: number }
    this.stats = new Map(); // userId -> { correctGuesses: 0, guessTimes: [], drawerPoints: 0 }
    this.historyLogs = [];
    
    this.hints = []; // Indices of revealed letters
    this.hintIntervalId = null;
    
    // Internal callback hook for GameSocket
    this._broadcastCallback = null;
  }

  startGame() {
    this.status = 'PLAYING';
    const playerIds = Array.from(this.players.keys());
    this.totalRounds = parseInt(this.settings.rounds) || 3;
    
    // Initialize scores
    playerIds.forEach(id => {
      this.scores.set(id, 0);
      this.stats.set(id, { correctGuesses: 0, guessTimes: [], drawerPoints: 0 });
      const p = this.players.get(id);
      p.role = p.role || 'PLAYER';
    });

    this.currentRound = 1;
    this.generateDrawerQueue();
    this.historyLogs = ['Game started. Round 1 begins!'];
    
    this.startNextTurn();
  }

  generateDrawerQueue() {
    // Establish initial turn order for the game session
    const playerIds = Array.from(this.players.keys());
    this.drawerQueue = playerIds.sort(() => 0.5 - Math.random());
    this.currentDrawerIndex = 0;
  }

  startNextTurn() {
    if (this.currentDrawerIndex >= this.drawerQueue.length) {
      // Round ended
      this.currentRound++;
      if (this.currentRound > this.totalRounds) {
        return this.finishGame();
      }
      // Keep clockwise / consistent turn order across rounds
      this.currentDrawerIndex = 0;
      this.historyLogs.push(`Round ${this.currentRound} started!`);
    }

    this.currentDrawerId = this.drawerQueue[this.currentDrawerIndex];
    this.turnState = 'WAITING_FOR_WORD';
    this.selectedWord = null;
    this.hints = [];
    
    // Reset guess status
    this.players.forEach((_, id) => {
      this.guessStatus.set(id, { hasGuessed: false, pointsEarned: 0 });
    });

    // Generate word choices
    this.wordChoices = WordService.getWordChoices(this.settings.category, this.settings.wordChoices, this.usedWords);
    
    // Auto-select after 15s if they don't pick
    this.drawingTimeLeft = 15; 
    this.clearTimers();
    this.timerIntervalId = setInterval(() => {
      this.drawingTimeLeft--;
      if (this.drawingTimeLeft <= 0) {
        // Auto pick a random word from choices
        const randomIndex = Math.floor(Math.random() * this.wordChoices.length);
        this.selectWord(this.wordChoices[randomIndex]);
      } else {
        this._broadcast();
      }
    }, 1000);
    
    this._broadcast();
  }

  selectWord(word) {
    if (this.turnState !== 'WAITING_FOR_WORD') return;
    
    this.selectedWord = word.toUpperCase();
    this.usedWords.push(this.selectedWord);
    this.turnState = 'DRAWING';
    
    this.historyLogs.push(`${this.players.get(this.currentDrawerId)?.nickname} is drawing!`);
    
    this.drawingTimeLeft = this.settings.drawingTime || 60;
    this.clearTimers();
    
    // Start drawing timer with continuous broadcast every second
    this.timerIntervalId = setInterval(() => {
      this.drawingTimeLeft--;
      if (this.drawingTimeLeft <= 0) {
        this.endTurn();
      } else {
        this._broadcast();
      }
    }, 1000);
    
    // Setup Hint Timer (2 hints max, at 2/3 and 1/3 of the time)
    const hintTimes = [
      Math.floor(this.drawingTimeLeft * (2/3)),
      Math.floor(this.drawingTimeLeft * (1/3))
    ];
    
    this.hintIntervalId = setInterval(() => {
      if (hintTimes.includes(this.drawingTimeLeft)) {
        this.giveHint();
        this._broadcast();
      }
    }, 1000);
    
    // Emit clear canvas event
    if (this._broadcastCallback) {
      // we need to tell clients to clear the canvas
      this.handlePlayerAction(this.currentDrawerId, 'clear_canvas', null);
    } else {
       this._broadcast();
    }
    
    // Force a broadcast now that the state has changed
    this._broadcast();
  }
    
    // End of duplicated logic
  
  giveHint() {
    if (!this.selectedWord) return;
    
    const availableIndices = [];
    for (let i = 0; i < this.selectedWord.length; i++) {
      if (this.selectedWord[i] !== ' ' && !this.hints.includes(i)) {
        availableIndices.push(i);
      }
    }
    
    if (availableIndices.length > 0) {
      const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      this.hints.push(randomIndex);
    }
  }

  endTurn() {
    this.clearTimers();
    this.turnState = 'ROUND_END';
    this.historyLogs.push(`The word was: ${this.selectedWord}`);
    this._broadcast();
    
    setTimeout(() => {
      if (this.status !== 'FINISHED') {
        this.currentDrawerIndex++;
        this.startNextTurn();
      }
    }, 5000);
  }

  finishGame() {
    this.clearTimers();
    this.status = 'FINISHED';
    this.turnState = 'ROUND_END';
    
    let winner = null;
    let maxScore = -1;
    this.scores.forEach((score, id) => {
      if (score > maxScore) {
        maxScore = score;
        winner = id;
      }
    });
    
    this.winnerId = winner;
    this.historyLogs.push(`Game Over! ${this.players.get(winner)?.nickname} wins with ${maxScore} points!`);
    this._broadcast();
  }

  handlePlayerAction(playerId, action, data) {
    if (this.status !== 'PLAYING') {
      return { success: false, error: 'Game is not running' };
    }

    if (action === 'select_word') {
      if (playerId !== this.currentDrawerId || this.turnState !== 'WAITING_FOR_WORD') {
        return { success: false, error: 'Cannot select word now' };
      }
      if (!this.wordChoices.includes(data.word.toUpperCase())) {
        return { success: false, error: 'Invalid word choice' };
      }
      this.selectWord(data.word.toUpperCase());
      return { success: true };
    }
    
    if (action === 'guess') {
      if (this.turnState !== 'DRAWING') return { success: false, error: 'Not guessing time' };
      if (playerId === this.currentDrawerId) return { success: false, error: 'Drawer cannot guess' };
      
      const guessInfo = this.guessStatus.get(playerId) || { hasGuessed: false };
      if (guessInfo.hasGuessed) return { success: false, error: 'Already guessed correctly' };
      
      const guess = data.guess.trim().toUpperCase();
      if (guess === this.selectedWord) {
        // Correct guess!
        const timeElapsed = (parseInt(this.settings.drawingTime) || 60) - this.drawingTimeLeft;
        const timeRatio = this.drawingTimeLeft / (parseInt(this.settings.drawingTime) || 60);
        // Base points for guessing correctly is 100, plus up to 400 based on time
        const points = Math.floor(100 + (300 * timeRatio));
        
        this.scores.set(playerId, (this.scores.get(playerId) || 0) + points);
        this.guessStatus.set(playerId, { hasGuessed: true, pointsEarned: points });
        
        const userStats = this.stats.get(playerId) || { correctGuesses: 0, guessTimes: [], drawerPoints: 0 };
        userStats.correctGuesses += 1;
        userStats.guessTimes.push(timeElapsed);
        this.stats.set(playerId, userStats);
        
        // Award drawer points (max 50 per correct guesser)
        const drawerPoints = 50;
        this.scores.set(this.currentDrawerId, (this.scores.get(this.currentDrawerId) || 0) + drawerPoints);
        
        const drawerStats = this.stats.get(this.currentDrawerId) || { correctGuesses: 0, guessTimes: [], drawerPoints: 0 };
        drawerStats.drawerPoints += drawerPoints;
        this.stats.set(this.currentDrawerId, drawerStats);
        
        this.historyLogs.push(`${this.players.get(playerId)?.nickname} guessed the word!`);
        
        // Check if everyone guessed
        const allGuessed = Array.from(this.players.keys()).every(id => {
          if (id === this.currentDrawerId) return true;
          return this.guessStatus.get(id)?.hasGuessed;
        });
        
        if (allGuessed) {
          this.endTurn();
        } else {
           this._broadcast();
        }
        
        // Return a broadcast event so chat can show the success locally
        return { 
          success: true, 
          broadcastEvent: { type: 'scribble_correct_guess', data: { userId: playerId, nickname: this.players.get(playerId)?.nickname } } 
        };
      } else {
        // Check for Close Guess
        const wordLength = this.selectedWord.length;
        const dist = levenshteinDistance(guess, this.selectedWord);
        let threshold = 1;
        if (wordLength >= 5) threshold = 2;
        if (wordLength >= 8) threshold = 3;
        const isClose = dist <= threshold;
        
        if (isClose) {
          return {
            success: true,
            broadcastEvent: { type: 'scribble_close_guess', data: { userId: playerId, nickname: this.players.get(playerId)?.nickname, guess: data.guess } }
          };
        }

        // Incorrect guess - can be broadcasted to a separate guess chat event
        return { 
          success: true, 
          broadcastEvent: { type: 'scribble_guess', data: { userId: playerId, nickname: this.players.get(playerId)?.nickname, guess: data.guess } } 
        };
      }
    }
    
    // Tools actions, handle clearing canvas via standard pipeline if needed
    if (action === 'clear_canvas') {
      if (playerId !== this.currentDrawerId) return { success: false, error: 'Not the drawer' };
      return { success: true, broadcastEvent: { type: 'scribble_clear_canvas', data: {} } };
    }
    
    return { success: false, error: 'Unknown action' };
  }

  _broadcast() {
    if (this._broadcastCallback) this._broadcastCallback();
  }

  clearTimers() {
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    if (this.hintIntervalId) clearInterval(this.hintIntervalId);
  }

  removePlayer(userId) {
    const wasRemoved = super.removePlayer(userId);
    if (wasRemoved && this.status === 'PLAYING') {
      if (this.currentDrawerId === userId) {
        this.historyLogs.push(`${this.players.get(userId)?.nickname || 'Drawer'} left. Skipping turn.`);
        this.endTurn();
      } else if (this.players.size < 2) {
        this.historyLogs.push('Not enough players left to continue.');
        this.finishGame();
      } else {
        // Check if the leaving player was the last one needed to guess
         const allGuessed = Array.from(this.players.keys()).every(id => {
          if (id === this.currentDrawerId) return true;
          return this.guessStatus.get(id)?.hasGuessed;
        });
        if (allGuessed && this.turnState === 'DRAWING') {
          this.endTurn();
        }
      }
    }
    return wasRemoved;
  }

  getMaskedWord() {
    if (!this.selectedWord) return '';
    if (this.turnState === 'ROUND_END') return this.selectedWord;
    
    let masked = '';
    for (let i = 0; i < this.selectedWord.length; i++) {
      if (this.selectedWord[i] === ' ') {
        masked += ' ';
      } else if (this.hints.includes(i)) {
        masked += this.selectedWord[i];
      } else {
        masked += '_';
      }
    }
    return masked;
  }

  serializeState(privatePlayerId) {
    const isDrawer = privatePlayerId === this.currentDrawerId;
    
    const playersList = Array.from(this.players.values()).map(p => ({
      userId: p.userId,
      nickname: p.nickname,
      role: p.role,
      isOnline: p.isOnline,
      score: this.scores.get(p.userId) || 0,
      hasGuessed: this.guessStatus.get(p.userId)?.hasGuessed || false
    }));
    
    let wordToDisplay = '';
    if (this.status === 'WAITING') {
      wordToDisplay = 'Waiting to start...';
    } else if (this.turnState === 'WAITING_FOR_WORD') {
      const drawer = this.players.get(this.currentDrawerId);
      const drawerName = drawer ? drawer.nickname : 'Drawer';
      wordToDisplay = `${drawerName} is choosing a word...`;
    } else {
       wordToDisplay = isDrawer ? this.selectedWord : this.getMaskedWord();
       
       // Also show full word if player guessed it correctly
       const guessInfo = this.guessStatus.get(privatePlayerId);
       if (guessInfo && guessInfo.hasGuessed && this.turnState === 'DRAWING') {
         wordToDisplay = this.selectedWord;
       }
    }

    return {
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      settings: this.settings,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      currentDrawerId: this.currentDrawerId,
      turnState: this.turnState,
      drawingTimeLeft: this.drawingTimeLeft,
      wordChoices: (isDrawer && this.turnState === 'WAITING_FOR_WORD') ? this.wordChoices : [],
      word: wordToDisplay,
      wordLength: this.selectedWord ? this.selectedWord.replace(/ /g, '').length : 0,
      players: playersList,
      historyLogs: this.historyLogs,
      winnerId: this.winnerId,
      stats: this.status === 'FINISHED' ? Array.from(this.stats.entries()).map(([id, st]) => ({ userId: id, ...st })) : []
    };
  }
}

module.exports = ScribbleEngine;
