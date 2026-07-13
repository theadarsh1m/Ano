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
  settings?: any;
}

export interface YatzyPlayerState {
  userId: string;
  nickname: string;
  role: 'HOST' | 'PLAYER';
  isReady: boolean;
  isOnline: boolean;
  scoreSheet: Record<string, number | null>;
  upperTotal: number;
  bonus: number;
  lowerTotal: number;
  grandTotal: number;
}

export interface YatzyGameState {
  gameId: string;
  gameType: 'YATZY';
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  dice: number[];
  heldDice: boolean[];
  rollsLeft: number;
  hasRolled: boolean;
  currentTurnPlayerId: string;
  currentRound: number;
  totalRounds: number;
  bonusThreshold: number;
  players: YatzyPlayerState[];
  possibleScores: Record<string, number> | null;
  winnerId: string | null;
  isDraw: boolean;
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

interface YatzyStore {
  lobby: LobbyState | null;
  gameState: YatzyGameState | null;
  error: string | null;
  availableLobbies: PublicLobby[];

  // Actions
  createLobby: (userId: string, nickname: string) => void;
  joinLobby: (gameId: string, userId: string, nickname: string) => void;
  toggleReady: (gameId: string, userId: string, isReady: boolean) => void;
  kickPlayer: (gameId: string, hostId: string, targetUserId: string) => void;
  leaveLobby: (gameId: string, userId: string) => void;
  invitePlayer: (gameId: string, senderId: string, senderName: string, targetUserId: string) => void;
  updateLobbySettings: (gameId: string, hostId: string, settings: any) => void;
  startGame: (gameId: string, hostId: string) => void;
  rollDice: (gameId: string, userId: string) => void;
  holdDice: (gameId: string, userId: string, diceIndex: number) => void;
  selectCategory: (gameId: string, userId: string, category: string) => void;
  clearState: () => void;
  setError: (msg: string | null) => void;
  fetchLobbies: () => void;

  // Listeners Setup
  setupListeners: (gameId: string, targetUserId: string) => () => void;
}

export const useYatzyStore = create<YatzyStore>((set, get) => ({
  lobby: null,
  gameState: null,
  error: null,
  availableLobbies: [],

  createLobby: (userId, nickname) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_create', { userId, nickname, gameType: 'YATZY' });
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
    set({ lobby: null, gameState: null, error: null });
  },

  invitePlayer: (gameId, senderId, senderName, targetUserId) => {
    socketService.getSocket().emit('lobby_invite', { gameId, senderId, senderName, targetUserId, gameType: 'YATZY' });
  },

  updateLobbySettings: (gameId, hostId, settings) => {
    socketService.getSocket().emit('lobby_settings_update', { gameId, hostId, settings });
  },

  startGame: (gameId, hostId) => {
    const socket = socketService.getSocket();
    socket.emit('game_start', { gameId, hostId });
  },

  rollDice: (gameId, userId) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'roll_dice', data: {} });
  },

  holdDice: (gameId, userId, diceIndex) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'hold_dice', data: { diceIndex } });
  },

  selectCategory: (gameId, userId, category) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'select_category', data: { category } });
  },

  clearState: () => set({ lobby: null, gameState: null, error: null }),
  setError: (msg) => set({ error: msg }),

  fetchLobbies: () => {
    const socket = socketService.getSocket();
    socket.emit('lobbies_list');
  },

  setupListeners: (gameId, targetUserId) => {
    const socket = socketService.getSocket();

    const onLobbyState = (state: LobbyState) => {
      if (state.gameType && state.gameType !== 'YATZY') return;
      set({ lobby: state, gameState: null });
    };

    const onGameState = (state: YatzyGameState) => {
      if (state.gameType && state.gameType !== 'YATZY') return;
      set({ gameState: state, lobby: null });
    };

    const onGameError = (err: { message: string }) => {
      set({ error: err.message });
      setTimeout(() => set({ error: null }), 3000);
    };

    const onKicked = () => {
      set({ lobby: null, gameState: null, error: 'You were kicked by the host.' });
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
    socket.on('game_error', onGameError);
    socket.on(`lobby_kicked_${gameId}_${targetUserId}`, onKicked);
    socket.on('lobbies_list_response', onLobbiesList);
    socket.on('lobbies_updated', onLobbiesUpdated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('lobby_state', onLobbyState);
      socket.off('game_state', onGameState);
      socket.off('game_error', onGameError);
      socket.off(`lobby_kicked_${gameId}_${targetUserId}`, onKicked);
      socket.off('lobbies_list_response', onLobbiesList);
      socket.off('lobbies_updated', onLobbiesUpdated);
    };
  }
}));
