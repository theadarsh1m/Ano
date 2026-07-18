/* eslint-disable @typescript-eslint/no-require-imports */
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

const INK_COLORS = [
  '#FF5DA8', // Cyber Pink
  '#6AA6FF', // Neon Blue
  '#F8D35F', // Gold/Warm Yellow
  '#2ED573', // Emerald/Mint Green
  '#FF5C5C', // Neon Red/Danger
  '#A29BFE', // Pastel Purple
  '#00CEC9', // Pastel Teal/Cyan
  '#FD79A8', // Soft Rose
  '#FFEAA7', // Cream Yellow
  '#E17055'  // Terracotta Orange
];

class InkDeceptionEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'INK_DECEPTION');
    
    // Central game config (all settings are fully customizable)
    this.settings = {
      rounds: 1,                 // New turn system uses a single complete round
      drawingTime: 20,           // Seconds per stroke
      discussionTime: 10,        // Seconds (default 10s)
      votingTime: 30,            // Seconds
      guessTime: 8,              // Seconds (default 8s for Caught Fake Artist)
      category: 'mixed',         // Category pack name or 'mixed'
      minPlayers: 3,             // Minimum players for social deduction
      maxPlayers: 10,            // Maximum players
      pointsArtistWin: 200,      // Score for Artists
      pointsFakeWin: 300,        // Score for Fake Artist
      reconnectTimeout: 15,      // Timeout for disconnected players in seconds
      hostMigrationTimeout: 15   // Host migration timeout in seconds
    };

    // Game state parameters
    this.currentRound = 1;
    this.totalRounds = 1;
    
    this.fakeArtistId = null;
    this.selectedWord = null;
    this.selectedCategory = null;
    
    // State machine: LOBBY, ROLE_REVEAL, DRAWING, DISCUSSION, VOTING, REVEAL, FAKE_GUESS, GAME_END
    this.turnState = 'LOBBY';
    this.timeLeft = 0;
    this.timerIntervalId = null;
    
    // Player statistics
    this.scores = new Map();       // userId -> total score
    this.inkColors = new Map();    // userId -> hex color code
    this.playerRoles = new Map();  // userId -> 'ARTIST' | 'FAKE_ARTIST'
    
    // Drawing states
    this.drawingQueue = [];        // Queue of player userIds
    this.currentDrawerIndex = 0;   // Index inside the queue
    this.currentTurnCount = 0;     // Number of strokes drawn
    this.totalTurns = 0;           // Total turns (drawing players count * 2)
    this.strokes = [];             // Strokes drawn in this round
    
    // Voting stats
    this.votes = new Map();        // voterId -> targetUserId
    this.mostVotedId = null;       // Most voted player ID
    
    // Guess details
    this.fakeGuessSubmitted = null;
    this.guessWordCorrect = false;
    this.roundWinner = null;       // 'ARTISTS' or 'FAKE_ARTIST'
    
    // Replay timelines
    this.roundReplays = {};        // roundNumber -> strokes[]
    this.historyLogs = [];
    this._broadcastCallback = null;

    // Disconnect states
    this.isPaused = false;
    this.pausedPlayerId = null;
    this.pauseTimeLeft = 0;
    this.pauseTimerIntervalId = null;

    // Role reveal acknowledgement
    this.roleSeenPlayers = new Set(); // Track players who've confirmed seeing their role
  }

  startGame() {
    this.status = 'PLAYING';
    const playerIds = Array.from(this.players.keys());
    this.currentRound = 1;
    this.totalRounds = parseInt(this.settings.rounds) || 3;
    this.roundReplays = {};

    // Initialize scores & assign distinct ink colors
    playerIds.forEach((id, idx) => {
      if (!this.scores.has(id)) {
        this.scores.set(id, 0);
      }
      this.inkColors.set(id, INK_COLORS[idx % INK_COLORS.length]);
    });

    this.historyLogs = ['Ink & Deception started. Trust no stroke!'];
    
    // Start automated round
    this.startRound();
  }

  startRound() {
    this.clearTimers();
    
    // Reset round states
    this.selectedWord = null;
    this.selectedCategory = null;
    this.fakeArtistId = null;
    this.votes.clear();
    this.mostVotedId = null;
    this.fakeGuessSubmitted = null;
    this.guessWordCorrect = false;
    this.roundWinner = null;
    this.strokes = [];
    this.playerRoles.clear();

    const playerIds = Array.from(this.players.keys());

    // 1. Choose Category and Word Automatically
    const chosenCategorySetting = this.settings.category || 'mixed';
    if (chosenCategorySetting.toLowerCase() === 'mixed') {
      const allCats = WordService.getAllCategories();
      this.selectedCategory = allCats[Math.floor(Math.random() * allCats.length)].toUpperCase();
    } else {
      this.selectedCategory = chosenCategorySetting.toUpperCase();
    }

    const choices = WordService.getWordChoices(this.selectedCategory.toLowerCase(), 1, []);
    this.selectedWord = choices[0].toUpperCase();

    // 2. Shuffle Players and Assign Exactly One Fake Artist
    const shuffledIds = [...playerIds].sort(() => 0.5 - Math.random());
    this.fakeArtistId = shuffledIds[0];
    
    playerIds.forEach(id => {
      if (id === this.fakeArtistId) {
        this.playerRoles.set(id, 'FAKE_ARTIST');
      } else {
        this.playerRoles.set(id, 'ARTIST');
      }
    });

    // 3. Set Up Drawing Queue (all players draw exactly twice)
    this.drawingQueue = [...playerIds].sort(() => 0.5 - Math.random());
    this.currentDrawerIndex = 0;
    this.currentTurnCount = 0;
    const turnsPerPlayer = parseInt(this.settings.turnsPerPlayer) || 2;
    this.totalTurns = this.drawingQueue.length * turnsPerPlayer;

    this.historyLogs.push(`Game started. Category: ${this.selectedCategory}. Role reveal in progress.`);

    // 4. Transition to Role Reveal (reset seen set, start 15s fallback timer)
    this.roleSeenPlayers = new Set();
    this.turnState = 'ROLE_REVEAL';
    this.timeLeft = 7;

    this.timerIntervalId = setInterval(() => {
      if (this.isPaused) return;
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.startDrawingPhase();
      }
      this._broadcast();
    }, 1000);

    this._broadcast();
  }

  startDrawingPhase() {
    this.clearTimers();
    this.turnState = 'DRAWING';
    this.currentDrawerIndex = 0;
    this.currentTurnCount = 0;
    this.startDrawerTurn();
  }

  startDrawerTurn() {
    this.clearTimers();
    const totalDrawers = this.drawingQueue.length;
    
    if (this.currentTurnCount >= this.totalTurns) {
      this.startDiscussionPhase();
      return;
    }

    const drawerIdx = this.currentTurnCount % totalDrawers;
    this.currentDrawerIndex = drawerIdx;
    const currentDrawerId = this.drawingQueue[drawerIdx];
    const player = this.players.get(currentDrawerId);
    
    if (player) {
      this.historyLogs.push(`Turn ${this.currentTurnCount + 1}/${this.totalTurns}: ${player.nickname} is drawing.`);
    }

    // Set time limits per stroke
    this.timeLeft = parseInt(this.settings.drawingTime) || 20;
    
    this.timerIntervalId = setInterval(() => {
      if (this.isPaused) return;
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        // Auto-submit empty coordinates if turn expires
        this.submitStroke(currentDrawerId, []);
      }
      this._broadcast();
    }, 1000);

    this._broadcast();
  }

  submitStroke(playerId, points) {
    if (this.isPaused) return { success: false, error: 'Game is paused' };
    if (this.turnState !== 'DRAWING') return { success: false, error: 'Not in drawing phase' };
    
    const activeDrawerId = this.drawingQueue[this.currentDrawerIndex];
    if (playerId !== activeDrawerId) {
      return { success: false, error: 'Not your turn to draw' };
    }

    // Record dynamic coordinates in server strokes database
    const strokeId = `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const inkColor = this.inkColors.get(playerId) || '#6AA6FF';
    
    this.strokes.push({
      strokeId,
      playerId,
      inkColor,
      points: points || []
    });

    this.currentTurnCount++;
    this.startDrawerTurn();
    
    return { success: true };
  }

  startDiscussionPhase() {
    this.clearTimers();
    this.turnState = 'DISCUSSION';
    this.historyLogs.push('Drawing finished. Start discussing! Expose the Fake Artist.');
    
    this.timeLeft = parseInt(this.settings.discussionTime) || 10;
    
    this.timerIntervalId = setInterval(() => {
      if (this.isPaused) return;
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.startVotingPhase();
      }
      this._broadcast();
    }, 1000);

    this._broadcast();
  }

  startVotingPhase() {
    this.clearTimers();
    this.turnState = 'VOTING';
    this.votes.clear();
    this.historyLogs.push('Voting has begun! Cast your vote secretly.');
    
    this.timeLeft = parseInt(this.settings.votingTime) || 30;
    
    this.timerIntervalId = setInterval(() => {
      if (this.isPaused) return;
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        // Auto-cast random votes for inactive voters
        const playersList = Array.from(this.players.keys());
        playersList.forEach(id => {
          if (!this.votes.has(id)) {
            const candidates = playersList.filter(c => c !== id);
            const randomCandidate = candidates[Math.floor(Math.random() * candidates.length)];
            this.castVote(id, randomCandidate);
          }
        });
        this.revealVotes();
      }
      this._broadcast();
    }, 1000);

    this._broadcast();
  }

  castVote(voterId, targetUserId) {
    if (this.isPaused) return { success: false, error: 'Game is paused' };
    if (this.turnState !== 'VOTING') return { success: false, error: 'Not in voting phase' };
    if (voterId === targetUserId) return { success: false, error: 'Cannot vote for yourself' };
    if (!this.players.has(targetUserId)) return { success: false, error: 'Target player not found' };

    this.votes.set(voterId, targetUserId);

    // If everyone has voted, reveal immediately
    if (this.votes.size === this.players.size) {
      this.revealVotes();
    } else {
      this._broadcast();
    }
    
    return { success: true };
  }

  revealVotes() {
    this.clearTimers();
    this.turnState = 'REVEAL';
    this.historyLogs.push('Revealing voting results...');

    // Tally votes
    const tally = {};
    this.votes.forEach((votedId) => {
      tally[votedId] = (tally[votedId] || 0) + 1;
    });

    // Find candidate with most votes
    let maxVotes = 0;
    let mostVotedPlayers = [];
    
    for (const [id, count] of Object.entries(tally)) {
      if (count > maxVotes) {
        maxVotes = count;
        mostVotedPlayers = [id];
      } else if (count === maxVotes) {
        mostVotedPlayers.push(id);
      }
    }

    // Determine if Fake Artist is caught. In case of ties, if Fake Artist is in the tie, they are caught.
    const isFakeArtistCaught = mostVotedPlayers.includes(this.fakeArtistId);
    this.mostVotedId = isFakeArtistCaught ? this.fakeArtistId : (mostVotedPlayers[0] || null);

    // Wait 5 seconds on reveal stage, then show transition
    this.timeLeft = 5;
    this.timerIntervalId = setInterval(() => {
      if (this.isPaused) return;
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.clearTimers();
        if (isFakeArtistCaught) {
          // Caught! Give them 8 seconds to guess the word
          this.startFakeArtistGuessPhase();
        } else {
          // Got away! Fake Artist wins this round
          this.endRound('FAKE_ARTIST');
        }
      }
      this._broadcast();
    }, 1000);

    this._broadcast();
  }

  startFakeArtistGuessPhase() {
    this.clearTimers();
    this.turnState = 'FAKE_GUESS';
    const fakeArtistName = this.players.get(this.fakeArtistId)?.nickname || 'Fake Artist';
    this.historyLogs.push(`${fakeArtistName} was caught! Guessing the secret word.`);
    
    this.timeLeft = parseInt(this.settings.guessTime) || 8;
    
    this.timerIntervalId = setInterval(() => {
      if (this.isPaused) return;
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        // Time ran out, Fake Artist guessed wrong
        this.submitFakeArtistGuess(this.fakeArtistId, "");
      }
      this._broadcast();
    }, 1000);

    this._broadcast();
  }

  submitFakeArtistGuess(playerId, guess) {
    if (this.isPaused) return { success: false, error: 'Game is paused' };
    if (this.turnState !== 'FAKE_GUESS') return { success: false, error: 'Not in guessing phase' };
    if (playerId !== this.fakeArtistId) return { success: false, error: 'Only the Fake Artist can guess' };

    this.fakeGuessSubmitted = guess;
    const normalizedGuess = guess.trim().toUpperCase();
    const correctWord = this.selectedWord.trim().toUpperCase();
    
    const isCorrect = normalizedGuess === correctWord;
    this.guessWordCorrect = isCorrect;

    if (isCorrect) {
      this.endRound('FAKE_ARTIST');
    } else {
      const dist = levenshteinDistance(normalizedGuess, correctWord);
      const isClose = dist > 0 && dist <= 2;
      
      if (isClose) {
        this.historyLogs.push(`🟡 "${guess}" is very close!`);
        this._broadcast();
        return { success: true, isClose: true };
      } else {
        this.endRound('ARTISTS');
      }
    }

    return { success: true };
  }

  endRound(winnerType) {
    this.clearTimers();
    this.roundWinner = winnerType;

    // Save strokes for this round's replay
    this.roundReplays[this.currentRound] = [...this.strokes];

    // Award points for this round
    const artistPoints = parseInt(this.settings.pointsArtistWin) || 200;
    const fakePoints = parseInt(this.settings.pointsFakeWin) || 300;
    const correctVoterBonus = 50; // Bonus for correctly identifying the Fake Artist

    if (winnerType === 'ARTISTS') {
      this.historyLogs.push(`Round ${this.currentRound}: Artists win! The word was: ${this.selectedWord}`);
      // All non-fake artists earn base points
      this.players.forEach((_, id) => {
        if (id !== this.fakeArtistId) {
          this.scores.set(id, (this.scores.get(id) || 0) + artistPoints);
        }
      });
      // Bonus points for players who correctly voted for the fake artist
      this.votes.forEach((votedId, voterId) => {
        if (votedId === this.fakeArtistId && voterId !== this.fakeArtistId) {
          this.scores.set(voterId, (this.scores.get(voterId) || 0) + correctVoterBonus);
          this.historyLogs.push(`${this.players.get(voterId)?.nickname || voterId} gets +${correctVoterBonus} bonus for correct vote!`);
        }
      });
    } else {
      this.historyLogs.push(`Round ${this.currentRound}: Fake Artist wins! The word was: ${this.selectedWord}`);
      this.scores.set(this.fakeArtistId, (this.scores.get(this.fakeArtistId) || 0) + fakePoints);
    }

    // Check if more rounds remain
    if (this.currentRound < this.totalRounds) {
      this.historyLogs.push(`Starting Round ${this.currentRound + 1} of ${this.totalRounds}...`);
      // Short pause, then start next round
      this.turnState = 'ROUND_END';
      this._broadcast();
      setTimeout(() => {
        this.currentRound++;
        this.startRound();
      }, 4000);
    } else {
      // All rounds done — finish game
      this.endGame(winnerType);
    }
  }

  endGame(winnerType) {
    this.clearTimers();
    this.status = 'FINISHED';
    this.turnState = 'GAME_END';
    this.roundWinner = winnerType;

    // Persist scores in Postgres
    const GamePersistenceService = require('../services/GamePersistenceService');
    const elapsedSeconds = Math.floor((Date.now() - new Date(this.gameId.split('_')[1])) / 1000) || 300;

    // Determine overall winner by highest score
    let maxScore = -1;
    let winnerId = null;
    this.scores.forEach((score, id) => {
      if (score > maxScore) { maxScore = score; winnerId = id; }
    });
    this.winnerId = winnerId;

    this.historyLogs.push(`Game over! Final scores determined.`);
    GamePersistenceService.recordResult(this.gameId, this.winnerId, elapsedSeconds).catch(console.error);

    this._broadcast();
  }

  handlePlayerDisconnect(userId) {
    const player = this.players.get(userId);
    if (!player) return;

    player.isOnline = false;
    this.isPaused = true;
    this.pausedPlayerId = userId;
    this.pauseTimeLeft = parseInt(this.settings.reconnectTimeout) || 15;

    this.clearTimers();
    if (this.pauseTimerIntervalId) {
      clearInterval(this.pauseTimerIntervalId);
    }

    this.pauseTimerIntervalId = setInterval(() => {
      this.pauseTimeLeft--;
      if (this.pauseTimeLeft <= 0) {
        clearInterval(this.pauseTimerIntervalId);
        this.pauseTimerIntervalId = null;
        this.handlePlayerTimeout(userId);
      }
      this._broadcast();
    }, 1000);

    this.historyLogs.push(`${player.nickname} disconnected. Pausing game.`);
    this._broadcast();
  }

  handlePlayerReconnect(userId) {
    const player = this.players.get(userId);
    if (!player) return;

    player.isOnline = true;

    if (this.isPaused && this.pausedPlayerId === userId) {
      this.isPaused = false;
      this.pausedPlayerId = null;
      if (this.pauseTimerIntervalId) {
        clearInterval(this.pauseTimerIntervalId);
        this.pauseTimerIntervalId = null;
      }
      
      this.historyLogs.push(`${player.nickname} reconnected. Resuming match.`);
      this.resumeStageTimer();
    }
    this._broadcast();
  }

  handlePlayerTimeout(userId) {
    this.isPaused = false;
    this.pausedPlayerId = null;
    this.removePlayer(userId);
  }

  resumeStageTimer() {
    this.clearTimers();

    if (this.turnState === 'ROLE_REVEAL') {
      this.timerIntervalId = setInterval(() => {
        this.timeLeft--;
        if (this.timeLeft <= 0) this.startDrawingPhase();
        this._broadcast();
      }, 1000);
    } else if (this.turnState === 'DRAWING') {
      this.timerIntervalId = setInterval(() => {
        this.timeLeft--;
        if (this.timeLeft <= 0) {
          const currentDrawerId = this.drawingQueue[this.currentDrawerIndex];
          this.submitStroke(currentDrawerId, []);
        }
        this._broadcast();
      }, 1000);
    } else if (this.turnState === 'DISCUSSION') {
      this.timerIntervalId = setInterval(() => {
        this.timeLeft--;
        if (this.timeLeft <= 0) this.startVotingPhase();
        this._broadcast();
      }, 1000);
    } else if (this.turnState === 'VOTING') {
      this.timerIntervalId = setInterval(() => {
        this.timeLeft--;
        if (this.timeLeft <= 0) {
          const playersList = Array.from(this.players.keys());
          playersList.forEach(id => {
            if (!this.votes.has(id)) {
              const candidates = playersList.filter(c => c !== id);
              const randomCandidate = candidates[Math.floor(Math.random() * candidates.length)];
              this.castVote(id, randomCandidate);
            }
          });
          this.revealVotes();
        }
        this._broadcast();
      }, 1000);
    } else if (this.turnState === 'REVEAL') {
      this.timerIntervalId = setInterval(() => {
        this.timeLeft--;
        if (this.timeLeft <= 0) {
          const tally = {};
          this.votes.forEach((votedId) => {
            tally[votedId] = (tally[votedId] || 0) + 1;
          });
          let maxVotes = 0;
          let mostVotedPlayers = [];
          for (const [id, count] of Object.entries(tally)) {
            if (count > maxVotes) {
              maxVotes = count;
              mostVotedPlayers = [id];
            } else if (count === maxVotes) {
              mostVotedPlayers.push(id);
            }
          }
          const isFakeArtistCaught = mostVotedPlayers.includes(this.fakeArtistId);
          if (isFakeArtistCaught) {
            this.startFakeArtistGuessPhase();
          } else {
            this.endRound('FAKE_ARTIST');
          }
        }
        this._broadcast();
      }, 1000);
    } else if (this.turnState === 'FAKE_GUESS') {
      this.timerIntervalId = setInterval(() => {
        this.timeLeft--;
        if (this.timeLeft <= 0) {
          this.submitFakeArtistGuess(this.fakeArtistId, "");
        }
        this._broadcast();
      }, 1000);
    }
  }

  migrateHostIfNeeded(disconnectedHostId) {
    const hostPlayer = this.players.get(disconnectedHostId);
    if (hostPlayer && hostPlayer.role === 'HOST') {
      const remainingPlayers = Array.from(this.players.values()).filter(p => p.userId !== disconnectedHostId && p.isOnline);
      if (remainingPlayers.length > 0) {
        remainingPlayers[0].role = 'HOST';
        this.historyLogs.push(`${remainingPlayers[0].nickname} has been promoted to Host.`);
      }
    }
  }

  handlePlayerAction(playerId, action, data) {
    console.log(`[${new Date().toISOString()}] [InkDeceptionEngine] handlePlayerAction: action="${action}" from playerId="${playerId}" data=`, data);
    if (this.status !== 'PLAYING') {
      return { success: false, error: 'Game is not running' };
    }

    switch (action) {
      case 'draw_stroke':
        return this.submitStroke(playerId, data.points);

      case 'vote':
        return this.castVote(playerId, data.targetUserId);

      case 'guess_word':
        return this.submitFakeArtistGuess(playerId, data.guess);

      case 'role_seen': {
        // Player confirmed they've read their role card
        if (this.turnState !== 'ROLE_REVEAL') return { success: false };
        this.roleSeenPlayers.add(playerId);
        const totalPlayers = Array.from(this.players.values()).filter(p => p.isOnline).length;
        console.log(`[InkDeceptionEngine] role_seen: ${this.roleSeenPlayers.size}/${totalPlayers} players ready`);
        // If every online player has seen their role, start drawing immediately
        if (this.roleSeenPlayers.size >= totalPlayers) {
          this.startDrawingPhase();
        }
        return { success: true };
      }

      case 'next_round': {
        // Reuse for next match
        const hostP = Array.from(this.players.values()).find(p => p.role === 'HOST');
        if (hostP && hostP.userId === playerId) {
          this.startRound();
          return { success: true };
        }
        return { success: false, error: 'Only host can start next round' };
      }

      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  _broadcast() {
    if (this._broadcastCallback) this._broadcastCallback();
  }

  clearTimers() {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  removePlayer(userId) {
    const wasRemoved = super.removePlayer(userId);
    if (wasRemoved) {
      this.migrateHostIfNeeded(userId);

      if (this.status === 'PLAYING') {
        this.historyLogs.push(`${userId} left the game.`);
        
        const minPlayers = parseInt(this.settings.minPlayers) || 3;
        if (this.players.size < minPlayers) {
          this.historyLogs.push('Not enough players left to continue.');
          this.endGame('ARTISTS');
        } else {
          if (this.fakeArtistId === userId) {
            this.historyLogs.push('Fake Artist left. Ending round.');
            this.endGame('ARTISTS');
          } else {
            this.drawingQueue = this.drawingQueue.filter(id => id !== userId);
            this.totalTurns = this.drawingQueue.length * 2;
            
            if (this.turnState === 'DRAWING') {
              const activeDrawerId = this.drawingQueue[this.currentDrawerIndex];
              if (!activeDrawerId || !this.players.has(activeDrawerId)) {
                this.currentDrawerIndex = this.currentDrawerIndex % this.drawingQueue.length;
                this.startDrawerTurn();
              }
            } else {
              this.resumeStageTimer();
            }
          }
        }
      }
    }
    return wasRemoved;
  }

  serializeState(privatePlayerId) {
    console.log(`[${new Date().toISOString()}] [InkDeceptionEngine] serializeState for playerId="${privatePlayerId}"`);
    const isFA = privatePlayerId === this.fakeArtistId;
    
    // Mask word for the Fake Artist, unless in game reveal/end phases
    let wordToDisplay = '???';
    if (this.selectedWord) {
      if (!isFA || this.turnState === 'GAME_END' || this.turnState === 'ROUND_END') {
        wordToDisplay = this.selectedWord;
      }
    }

    const playersList = Array.from(this.players.values()).map(p => ({
      userId: p.userId,
      nickname: p.nickname,
      isOnline: p.isOnline,
      role: p.userId === this.fakeArtistId ? 'FAKE_ARTIST' : 'ARTIST',
      score: this.scores.get(p.userId) || 0,
      inkColor: this.inkColors.get(p.userId) || '#6AA6FF',
      hasVoted: this.votes.has(p.userId),
      votedFor: (this.turnState === 'REVEAL' || this.turnState === 'GAME_END' || this.turnState === 'ROUND_END') ? this.votes.get(p.userId) : null,
      isHost: p.role === 'HOST'
    }));

    // Mask actual roles for other players during gameplay
    const maskedPlayersList = playersList.map(p => {
      const isSelf = p.userId === privatePlayerId;
      const showTrueRole = isSelf || this.turnState === 'REVEAL' || 
                            this.turnState === 'GAME_END' || this.turnState === 'ROUND_END' || 
                            this.status === 'FINISHED';
      return {
        ...p,
        role: showTrueRole ? p.role : 'PLAYER'
      };
    });

    return {
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      settings: this.settings,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      
      fakeArtistId: (this.turnState === 'GAME_END' || this.turnState === 'ROUND_END') ? this.fakeArtistId : null,
      
      word: wordToDisplay,
      category: this.selectedCategory,
      wordChoices: [],
      
      turnState: this.turnState,
      timeLeft: this.timeLeft,
      
      players: maskedPlayersList,
      historyLogs: this.historyLogs,
      strokes: this.strokes,
      roundWinner: this.roundWinner,
      winnerId: this.winnerId,
      
      // Active drawer info
      activeDrawerId: this.turnState === 'DRAWING' ? this.drawingQueue[this.currentDrawerIndex] : null,
      drawingQueue: this.drawingQueue,
      currentTurnCount: this.currentTurnCount,
      totalTurns: this.totalTurns,
      
      // Replay databases
      roundReplays: this.roundReplays,
      mostVotedId: this.mostVotedId,
      guessWordCorrect: this.guessWordCorrect,

      // Disconnect details
      isPaused: this.isPaused,
      pausedPlayerId: this.pausedPlayerId,
      pauseTimeLeft: this.pauseTimeLeft
    };
  }
}

module.exports = InkDeceptionEngine;
