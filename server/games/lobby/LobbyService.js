const GamePersistenceService = require('../services/GamePersistenceService');

const MAX_PLAYERS = {
  'BLUFF': 6,
  'MEMORY_MATCH': 8,
  'DOTS_AND_BOXES': 8,
  'YATZY': 8,
  'COLOR_WARS': 8,
  'INK_DECEPTION': 10,
};
const DEFAULT_MAX_PLAYERS = 6;

class LobbyService {
  constructor() {
    this.lobbies = new Map(); // lobbyId -> { id, hostId, gameType, players: Map(userId -> { userId, nickname, isReady, role }), status: "WAITING" }
  }

  async createLobby(lobbyId, hostId, hostName, gameType) {
    const lobby = {
      id: lobbyId,
      hostId,
      gameType,
      players: new Map([[hostId, { userId: hostId, nickname: hostName, isReady: true, role: 'HOST' }]]),
      status: 'WAITING',
      settings: {
        maxPlayers: MAX_PLAYERS[gameType] || DEFAULT_MAX_PLAYERS,
        boardSize: gameType === 'COLOR_WARS' ? 7 : (gameType === 'DOTS_AND_BOXES' ? 5 : undefined), // Default 7x7 for Color Wars
        turnTimer: (gameType === 'COLOR_WARS' || gameType === 'DOTS_AND_BOXES') ? 30 : undefined, // 30s turn timer
        pairCount: gameType === 'MEMORY_MATCH' ? 12 : undefined, // Default 12 pairs (4x6) for Memory Match
        bonusThreshold: gameType === 'YATZY' ? 63 : undefined, // Upper section bonus threshold for Yatzy
      }
    };
    this.lobbies.set(lobbyId, lobby);
    await GamePersistenceService.createSession(lobbyId, gameType);
    await GamePersistenceService.addPlayer(lobbyId, hostId, hostName, 'HOST');
    return lobby;
  }

  async joinLobby(lobbyId, userId, nickname) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;
    const maxPlayers = lobby.settings?.maxPlayers || MAX_PLAYERS[lobby.gameType] || DEFAULT_MAX_PLAYERS;
    if (lobby.players.size >= maxPlayers) return null; // limit to max players

    const player = { userId, nickname, isReady: false, role: 'PLAYER' };
    lobby.players.set(userId, player);
    await GamePersistenceService.addPlayer(lobbyId, userId, nickname, 'PLAYER');
    return lobby;
  }

  async leaveLobby(lobbyId, userId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;

    lobby.players.delete(userId);
    await GamePersistenceService.removePlayer(lobbyId, userId);

    if (lobby.players.size === 0) {
      this.lobbies.delete(lobbyId);
      return null;
    }

    if (lobby.hostId === userId) {
      // Nominate next host
      const nextHostId = lobby.players.keys().next().value;
      lobby.hostId = nextHostId;
      const nextHost = lobby.players.get(nextHostId);
      nextHost.role = 'HOST';
      nextHost.isReady = true;
      await GamePersistenceService.addPlayer(lobbyId, nextHostId, nextHost.nickname, 'HOST');
    }
    return lobby;
  }

  toggleReady(lobbyId, userId, isReady) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;

    const player = lobby.players.get(userId);
    if (player && player.role !== 'HOST') {
      player.isReady = isReady;
    }
    return lobby;
  }

  kickPlayer(lobbyId, hostId, targetUserId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby || lobby.hostId !== hostId) return null;

    lobby.players.delete(targetUserId);
    GamePersistenceService.removePlayer(lobbyId, targetUserId).catch(console.error);
    return lobby;
  }

  getLobby(lobbyId) {
    return this.lobbies.get(lobbyId);
  }

  getPublicLobbies() {
    const results = [];
    for (const [id, lobby] of this.lobbies) {
      if (lobby.status !== 'WAITING') continue;
      const host = lobby.players.get(lobby.hostId);
      results.push({
        id: lobby.id,
        hostId: lobby.hostId,
        hostName: host ? host.nickname : 'Unknown',
        gameType: lobby.gameType,
        playerCount: lobby.players.size,
        maxPlayers: lobby.settings?.maxPlayers || MAX_PLAYERS[lobby.gameType] || DEFAULT_MAX_PLAYERS,
        status: lobby.status,
      });
    }
    return results;
  }
}

module.exports = new LobbyService();
