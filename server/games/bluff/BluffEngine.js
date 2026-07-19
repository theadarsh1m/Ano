const BaseGameEngine = require('../engine/BaseGameEngine');
const Deck = require('./Deck');
const Rules = require('./Rules');
const { DECLARED_RANKS } = require('./Types');
const GamePersistenceService = require('../services/GamePersistenceService');

class BluffEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'BLUFF');
    this.deck = [];
    this.pile = []; // Array of { id, suit, value, playerId }
    this.lastPlay = null; // { playerId, cardCount, declaredRank, cards: [...] }
    this.declaredRank = null; // Currently active declared rank for the round
    this.currentTurnIdx = 0;
    this.winnerId = null;
    this.historyLogs = []; // Array of strings detailing action history log
  }

  startGame() {
    this.status = 'PLAYING';
    const playerIds = Array.from(this.players.keys());
    const count = playerIds.length;

    // 1. Create and Shuffle Deck
    const cards = Deck.shuffle(Deck.createDeck());

    // 2. Deal hands
    const hands = Deck.deal(cards, count);
    playerIds.forEach((id, idx) => {
      const p = this.players.get(id);
      p.hand = hands[idx];
      p.role = idx === 0 ? 'HOST' : 'PLAYER';
    });

    this.currentTurnIdx = 0;
    this.pile = [];
    this.lastPlay = null;
    this.declaredRank = null;
    this.winnerId = null;
    this.historyLogs = ['Game started. Cards dealt.'];

    // Save initial state to DB
    this.persistState();
  }

  handlePlayerAction(playerId, action, data) {
    const playerIds = Array.from(this.players.keys());
    const currentTurnPlayerId = playerIds[this.currentTurnIdx];

    // Validate turn order for non-challenge actions
    if (action !== 'challenge_bluff' && playerId !== currentTurnPlayerId) {
      return { success: false, error: 'Not your turn!' };
    }

    if (this.status === 'FINISHED') {
      return { success: false, error: 'Game already finished!' };
    }

    switch (action) {
      case 'play_cards':
        return this.playCardsAction(playerId, data);
      case 'challenge_bluff':
        return this.challengeBluffAction(playerId);
      default:
        return { success: false, error: 'Unknown action!' };
    }
  }

  removePlayer(userId) {
    if (!this.players.has(userId)) return false;
    
    const playerIds = Array.from(this.players.keys());
    const idx = playerIds.indexOf(userId);
    
    this.players.delete(userId);
    
    if (this.currentTurnIdx > idx) {
       this.currentTurnIdx--;
    } else if (this.currentTurnIdx === idx) {
       if (this.currentTurnIdx >= this.players.size) {
           this.currentTurnIdx = 0;
       }
    }

    if (this.players.size < 2 && this.status !== 'FINISHED') {
       this.status = 'FINISHED';
       this.winnerId = Array.from(this.players.values())[0]?.userId;
    }
    return true;
  }

  playCardsAction(playerId, data) {
    const { cardIds, declaredRank } = data;
    const player = this.players.get(playerId);

    // If there is a previous play, check if that player has emptied their hand.
    // Since the current player is playing cards instead of challenging, the previous play is accepted.
    if (this.lastPlay) {
      const prevPlayer = this.players.get(this.lastPlay.playerId);
      if (prevPlayer && prevPlayer.hand.length === 0) {
        this.winnerId = prevPlayer.userId;
        this.status = 'FINISHED';
        this.historyLogs.push(`${prevPlayer.nickname}'s play was accepted with 0 cards left and wins the game!`);
        GamePersistenceService.recordResult(this.gameId, prevPlayer.userId, 60).catch(console.error);
        this.persistState();
        return { success: true };
      }
    }

    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      return { success: false, error: 'No cards selected!' };
    }

    if (!declaredRank || !DECLARED_RANKS.includes(declaredRank)) {
      return { success: false, error: 'Invalid declared rank!' };
    }

    // Verify target rank consistency: players cannot change the rank mid-round
    if (this.declaredRank && declaredRank !== this.declaredRank) {
      return { success: false, error: `You must claim the active rank of this round: ${this.declaredRank}!` };
    }

    // Verify card ownership in hand
    const selectedCards = [];
    for (const cid of cardIds) {
      const card = player.hand.find(c => c.id === cid);
      if (!card) {
        return { success: false, error: 'Card not found in your hand!' };
      }
      selectedCards.push(card);
    }

    // Remove cards from player hand
    player.hand = player.hand.filter(c => !cardIds.includes(c.id));

    // Place face down in pile
    const pileCards = selectedCards.map(c => ({ ...c, playerId }));
    this.pile.push(...pileCards);

    // Save as last play
    this.lastPlay = {
      playerId,
      cardCount: cardIds.length,
      declaredRank,
      cards: pileCards
    };

    this.declaredRank = declaredRank;

    const logMsg = `${player.nickname} played ${cardIds.length} card(s) claiming "${declaredRank}"`;
    this.historyLogs.push(logMsg);

    // Check immediate victory (0 cards left)
    // Note: They can win only if they pass all potential challenges, so we check win later.
    
    // Cycle turn
    this.cycleTurn();

    // Persist
    GamePersistenceService.recordMove(this.gameId, playerId, 'PLAY_CARDS', { cardCount: cardIds.length, declaredRank }).catch(console.error);
    this.persistState();

    return { success: true };
  }

  challengeBluffAction(challengerId) {
    if (!this.lastPlay) {
      return { success: false, error: 'No play to challenge!' };
    }

    if (this.lastPlay.playerId === challengerId) {
      return { success: false, error: 'You cannot challenge your own play!' };
    }

    const playerIds = Array.from(this.players.keys());
    const currentTurnPlayerId = playerIds[this.currentTurnIdx];
    
    // STRICT RULE: Only the next player in turn order can challenge the previous move.
    if (challengerId !== currentTurnPlayerId) {
      return { success: false, error: 'You can only challenge if it is your turn next!' };
    }

    const challenger = this.players.get(challengerId);
    const targetId = this.lastPlay.playerId;
    const target = this.players.get(targetId);

    // CHALLENGE LOGIC: Evaluate ONLY the cards from the immediately previous move
    const isTruth = Rules.isTruth(this.lastPlay.cards, this.lastPlay.declaredRank);
    let resultLog = '';
    let winnerIdOfChallenge = '';
    let loserIdOfChallenge = '';

    if (isTruth) {
      // Challenger loses, collects the entire pile
      challenger.hand.push(...this.pile);
      resultLog = `${challenger.nickname} challenged ${target.nickname} and FAILED! ${challenger.nickname} picks up the entire pile (${this.pile.length} cards).`;
      winnerIdOfChallenge = targetId;
      loserIdOfChallenge = challengerId;
    } else {
      // Bluffer loses, collects the entire pile
      target.hand.push(...this.pile);
      resultLog = `${challenger.nickname} challenged ${target.nickname} and succeeded! ${target.nickname} was BLUFFING and picks up the entire pile (${this.pile.length} cards).`;
      winnerIdOfChallenge = challengerId;
      loserIdOfChallenge = targetId;
    }

    this.historyLogs.push(resultLog);

    // Check if anyone won (0 cards in hand)
    this.checkWinConditions();

    // Clear pile and round claims
    const cardsRevealed = [...this.lastPlay.cards];
    this.pile = [];
    this.lastPlay = null;
    this.declaredRank = null;

    // Turn goes to the winner of the challenge to start a new round
    this.currentTurnIdx = playerIds.indexOf(winnerIdOfChallenge);

    // Persist
    GamePersistenceService.recordMove(this.gameId, challengerId, 'CHALLENGE_BLUFF', { targetId, isTruth, winnerId: winnerIdOfChallenge }).catch(console.error);
    this.persistState();

    return { 
      success: true, 
      challengeResult: { 
        isTruth, 
        challengerId, 
        targetId, 
        cards: cardsRevealed,
        log: resultLog
      } 
    };
  }

  cycleTurn() {
    const playerIds = Array.from(this.players.keys());
    let safety = 0;
    do {
      this.currentTurnIdx = (this.currentTurnIdx + 1) % playerIds.length;
      safety++;
    } while (!this.players.get(playerIds[this.currentTurnIdx]).isOnline && safety < playerIds.length);
  }

  checkWinConditions() {
    for (const [id, p] of this.players.entries()) {
      if (p.hand.length === 0) {
        this.winnerId = id;
        this.status = 'FINISHED';
        this.historyLogs.push(`${p.nickname} has no cards left and WINS the game!`);
        
        // Log game result to DB
        GamePersistenceService.recordResult(this.gameId, id, 60).catch(console.error); // 60s fallback
        break;
      }
    }
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
        cardCount: p.hand ? p.hand.length : 0,
        // Only return hand to the owner
        hand: id === privatePlayerId ? (p.hand || []) : undefined
      });
    });

    return {
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      currentTurnIdx: this.currentTurnIdx,
      declaredRank: this.declaredRank,
      pileCount: this.pile.length,
      winnerId: this.winnerId,
      players: playersList,
      historyLogs: this.historyLogs,
      lastPlay: this.lastPlay ? {
        playerId: this.lastPlay.playerId,
        cardCount: this.lastPlay.cardCount,
        declaredRank: this.lastPlay.declaredRank,
        // Never expose played cards unless challenged/revealed
        cards: undefined
      } : null
    };
  }

  persistState() {
    // Serialize complete state for DB recovery
    const playersArr = [];
    this.players.forEach((p) => {
      playersArr.push({
        userId: p.userId,
        nickname: p.nickname,
        role: p.role,
        isReady: p.isReady,
        isOnline: p.isOnline,
        hand: p.hand || []
      });
    });

    const fullState = {
      deck: this.deck,
      pile: this.pile,
      lastPlay: this.lastPlay,
      declaredRank: this.declaredRank,
      currentTurnIdx: this.currentTurnIdx,
      winnerId: this.winnerId,
      historyLogs: this.historyLogs,
      players: playersArr
    };

    GamePersistenceService.saveSessionState(this.gameId, fullState, this.status).catch(console.error);
  }

  restoreState(state) {
    this.deck = state.deck || [];
    this.pile = state.pile || [];
    this.lastPlay = state.lastPlay || null;
    this.declaredRank = state.declaredRank || null;
    this.currentTurnIdx = state.currentTurnIdx || 0;
    this.winnerId = state.winnerId || null;
    this.historyLogs = state.historyLogs || [];

    if (state.players && Array.isArray(state.players)) {
      state.players.forEach((p) => {
        this.players.set(p.userId, {
          userId: p.userId,
          nickname: p.nickname,
          role: p.role,
          isReady: p.isReady,
          isOnline: p.isOnline,
          hand: p.hand || []
        });
      });
    }
    
    // Save backup mapping online status
    this.persistState();
  }
}

module.exports = BluffEngine;
