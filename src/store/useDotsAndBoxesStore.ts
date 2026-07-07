import { create } from 'zustand';
import { socketService } from '@/lib/socket';
import { useUserStore } from './useUserStore';

export interface LobbyPlayer {
  userId: string;
  nickname: string;
  isReady: boolean;
  role: 'HOST' | 'PLAYER';
}

export interface LobbySettings {
  maxPlayers: number;
  boardSize: number; // e.g. 5 for 5x5 dots
  turnTimer: number; // seconds
}

export interface LobbyState {
  id: string;
  hostId: string;
  gameType: string;
  players: LobbyPlayer[];
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  settings?: LobbySettings;
}

export interface DotsPlayerState {
  userId: string;
  nickname: string;
  role: 'HOST' | 'PLAYER';
  isReady: boolean;
  isOnline: boolean;
  score: number;
}

export interface DotsAndBoxesGameState {
  gameId: string;
  gameType: 'DOTS_AND_BOXES';
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  boardSize: number;
  hLines: (string | null)[][]; // R x (C-1)
  vLines: (string | null)[][]; // (R-1) x C
  boxes: (string | null)[][];  // (R-1) x (C-1)
  currentTurnPlayerId: string;
  turnTimeLeft: number;
  players: DotsPlayerState[];
  winnerId: string | null;
  isDraw: boolean;
  historyLogs: string[];
}

export interface DotsResultEvent {
  type: 'H' | 'V';
  r: number;
  c: number;
  playerId: string;
  completedBoxes: { r: number; c: number }[];
}

export interface PublicLobby {
  id: string;
  hostId: string;
  hostName: string;
  gameType: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
  settings?: LobbySettings;
}

interface DotsAndBoxesStore {
  lobby: LobbyState | null;
  gameState: DotsAndBoxesGameState | null;
  lastMoveResult: DotsResultEvent | null;
  error: string | null;
  availableLobbies: PublicLobby[];

  // Actions
  createLobby: (userId: string, nickname: string) => void;
  joinLobby: (gameId: string, userId: string, nickname: string) => void;
  toggleReady: (gameId: string, userId: string, isReady: boolean) => void;
  kickPlayer: (gameId: string, hostId: string, targetUserId: string) => void;
  leaveLobby: (gameId: string, userId: string) => void;
  invitePlayer: (gameId: string, senderId: string, senderName: string, targetUserId: string) => void;
  updateSettings: (gameId: string, hostId: string, settings: Partial<LobbySettings>) => void;
  startGame: (gameId: string, hostId: string) => void;
  drawLine: (gameId: string, userId: string, type: 'H' | 'V', r: number, c: number) => void;
  clearState: () => void;
  setError: (msg: string | null) => void;
  fetchLobbies: () => void;

  // Listeners Setup
  setupListeners: (gameId: string, targetUserId: string) => () => void;
}

export const useDotsAndBoxesStore = create<DotsAndBoxesStore>((set, get) => ({
  lobby: null,
  gameState: null,
  lastMoveResult: null,
  error: null,
  availableLobbies: [],

  createLobby: (userId, nickname) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_create', { gameType: 'DOTS_AND_BOXES', userId, nickname });
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
    set({ lobby: null, gameState: null, lastMoveResult: null, error: null });
  },

  invitePlayer: (gameId, senderId, senderName, targetUserId) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_invite', { gameId, senderId, senderName, targetUserId, gameType: 'DOTS_AND_BOXES' });
  },

  updateSettings: (gameId, hostId, settings) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_settings_update', { gameId, hostId, settings });
  },

  startGame: (gameId, hostId) => {
    const socket = socketService.getSocket();
    socket.emit('game_start', { gameId, hostId });
  },

  drawLine: (gameId, userId, type, r, c) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'draw_line', data: { type, r, c } });
  },

  clearState: () => set({ lobby: null, gameState: null, lastMoveResult: null, error: null }),
  setError: (msg) => set({ error: msg }),

  fetchLobbies: () => {
    const socket = socketService.getSocket();
    socket.emit('lobbies_list');
  },

  setupListeners: (gameId, targetUserId) => {
    const socket = socketService.getSocket();

    const onLobbyState = (state: LobbyState) => {
      if (state.gameType && state.gameType !== 'DOTS_AND_BOXES') return;
      set({ lobby: state, gameState: null });
    };

    const onGameState = (state: DotsAndBoxesGameState) => {
      if (state.gameType && state.gameType !== 'DOTS_AND_BOXES') return;
      set({ gameState: state, lobby: null });
    };

    const onDrawResult = (result: DotsResultEvent) => {
      set({ lastMoveResult: result });
      setTimeout(() => {
        set({ lastMoveResult: null });
      }, 1000);
    };

    const onGameError = (err: { message: string }) => {
      set({ error: err.message });
      setTimeout(() => set({ error: null }), 3000);
    };

    const onKicked = () => {
      set({ lobby: null, gameState: null, lastMoveResult: null, error: 'You were kicked by the host.' });
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
    socket.on('dots_and_boxes_result', onDrawResult);
    socket.on('game_error', onGameError);
    socket.on(`lobby_kicked_${gameId}_${targetUserId}`, onKicked);
    socket.on('lobbies_list_response', onLobbiesList);
    socket.on('lobbies_updated', onLobbiesUpdated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('lobby_state', onLobbyState);
      socket.off('game_state', onGameState);
      socket.off('dots_and_boxes_result', onDrawResult);
      socket.off('game_error', onGameError);
      socket.off(`lobby_kicked_${gameId}_${targetUserId}`, onKicked);
      socket.off('lobbies_list_response', onLobbiesList);
      socket.off('lobbies_updated', onLobbiesUpdated);
    };
  }
}));
