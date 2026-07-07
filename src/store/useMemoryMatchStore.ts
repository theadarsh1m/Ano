import { create } from 'zustand';
import { socketService } from '@/lib/socket';
import { useUserStore } from './useUserStore';

export interface LobbyPlayer {
  userId: string;
  nickname: string;
  isReady: boolean;
  role: 'HOST' | 'PLAYER';
}

export interface LobbyState {
  id: string;
  hostId: string;
  gameType: string;
  players: LobbyPlayer[];
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
}

export interface MemoryCard {
  index: number;
  symbol: string | null;
  isFlipped: boolean;
  isMatched: boolean;
  matchedBy: string | null;
}

export interface MemoryPlayerState {
  userId: string;
  nickname: string;
  role: 'HOST' | 'PLAYER';
  isReady: boolean;
  isOnline: boolean;
  score: number;
}

export interface MemoryMatchResult {
  isMatch: boolean;
  cardIndex1: number;
  cardIndex2: number;
  symbol?: string;
  symbol1?: string;
  symbol2?: string;
  playerId: string;
  playerName: string;
  newScore?: number;
  flipBackDelay?: number;
}

export interface MemoryMatchGameState {
  gameId: string;
  gameType: 'MEMORY_MATCH';
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  board: MemoryCard[];
  boardRows: number;
  boardCols: number;
  currentTurnPlayerId: string;
  players: MemoryPlayerState[];
  winnerId: string | null;
  isDraw: boolean;
  totalPairs: number;
  matchedPairs: number;
  historyLogs: string[];
}

export interface PublicLobby {
  id: string;
  hostId: string;
  hostName: string;
  gameType: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
}

interface MemoryMatchStore {
  lobby: LobbyState | null;
  gameState: MemoryMatchGameState | null;
  matchResult: MemoryMatchResult | null;
  error: string | null;
  availableLobbies: PublicLobby[];

  // Actions
  createLobby: (userId: string, nickname: string) => void;
  joinLobby: (gameId: string, userId: string, nickname: string) => void;
  toggleReady: (gameId: string, userId: string, isReady: boolean) => void;
  kickPlayer: (gameId: string, hostId: string, targetUserId: string) => void;
  leaveLobby: (gameId: string, userId: string) => void;
  invitePlayer: (gameId: string, senderId: string, senderName: string, targetUserId: string) => void;
  startGame: (gameId: string, hostId: string) => void;
  flipCard: (gameId: string, userId: string, cardIndex: number) => void;
  clearState: () => void;
  setError: (msg: string | null) => void;
  fetchLobbies: () => void;

  // Listeners Setup
  setupListeners: (gameId: string, targetUserId: string) => () => void;
}

export const useMemoryMatchStore = create<MemoryMatchStore>((set, get) => ({
  lobby: null,
  gameState: null,
  matchResult: null,
  error: null,
  availableLobbies: [],

  createLobby: (userId, nickname) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_create', { gameType: 'MEMORY_MATCH', userId, nickname });
  },

  joinLobby: (gameId, userId, nickname) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_join', { gameId, userId, nickname });
  },

  toggleReady: (gameId, userId, isReady) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_ready', { gameId, userId, isReady });
  },

  kickPlayer: (gameId, hostId, targetUserId) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_kick', { gameId, hostId, targetUserId });
  },

  leaveLobby: (gameId, userId) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_leave', { gameId, userId });
    set({ lobby: null, gameState: null, matchResult: null, error: null });
  },

  invitePlayer: (gameId, senderId, senderName, targetUserId) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_invite', { gameId, senderId, senderName, targetUserId, gameType: 'MEMORY_MATCH' });
  },

  startGame: (gameId, hostId) => {
    const socket = socketService.getSocket();
    socket.emit('game_start', { gameId, hostId });
  },

  flipCard: (gameId, userId, cardIndex) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'flip_card', data: { cardIndex } });
  },

  clearState: () => set({ lobby: null, gameState: null, matchResult: null, error: null }),
  setError: (msg) => set({ error: msg }),

  fetchLobbies: () => {
    const socket = socketService.getSocket();
    socket.emit('lobbies_list');
  },

  setupListeners: (gameId, targetUserId) => {
    const socket = socketService.getSocket();

    const onLobbyState = (state: LobbyState) => {
      // Only listen to MEMORY_MATCH lobbies
      if (state.gameType && state.gameType !== 'MEMORY_MATCH') return;
      set({ lobby: state, gameState: null });
    };

    const onGameState = (state: MemoryMatchGameState) => {
      if (state.gameType && state.gameType !== 'MEMORY_MATCH') return;
      set({ gameState: state, lobby: null });
    };

    const onMatchResult = (result: MemoryMatchResult) => {
      set({ matchResult: result });
      // Clear after animation time
      const clearDelay = result.isMatch ? 1000 : (result.flipBackDelay || 1500) + 500;
      setTimeout(() => {
        set({ matchResult: null });
      }, clearDelay);
    };

    const onGameError = (err: { message: string }) => {
      set({ error: err.message });
      setTimeout(() => set({ error: null }), 3000);
    };

    const onKicked = () => {
      set({ lobby: null, gameState: null, matchResult: null, error: 'You were kicked by the host.' });
    };

    const onLobbiesList = (lobbies: PublicLobby[]) => {
      set({ availableLobbies: lobbies });
    };

    const onLobbiesUpdated = (lobbies: PublicLobby[]) => {
      set({ availableLobbies: lobbies });
    };

    const handleConnect = () => {
      const currentLobby = get().lobby;
      const currentGameState = get().gameState;
      if (currentLobby) {
        socket.emit('lobby_join', {
          gameId: currentLobby.id,
          userId: targetUserId,
          nickname: useUserStore.getState().nickname || 'Player'
        });
      } else if (currentGameState) {
        socket.emit('game_reconnect', {
          gameId: currentGameState.gameId,
          userId: targetUserId
        });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('lobby_state', onLobbyState);
    socket.on('game_state', onGameState);
    socket.on('memory_match_result', onMatchResult);
    socket.on('game_error', onGameError);
    socket.on(`lobby_kicked_${gameId}_${targetUserId}`, onKicked);
    socket.on('lobbies_list_response', onLobbiesList);
    socket.on('lobbies_updated', onLobbiesUpdated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('lobby_state', onLobbyState);
      socket.off('game_state', onGameState);
      socket.off('memory_match_result', onMatchResult);
      socket.off('game_error', onGameError);
      socket.off(`lobby_kicked_${gameId}_${targetUserId}`, onKicked);
      socket.off('lobbies_list_response', onLobbiesList);
      socket.off('lobbies_updated', onLobbiesUpdated);
    };
  }
}));
