import { create } from 'zustand';
import { socketService } from '@/lib/socket';
import { useUserStore } from './useUserStore';
import { Player } from '@/types/anigravity/game';

export interface LobbyPlayer {
  userId: string;
  nickname: string;
  isReady: boolean;
  role: 'HOST' | 'PLAYER';
}

export interface LobbySettings {
  maxPlayers: number;
}

export interface LobbyState {
  id: string;
  hostId: string;
  gameType: string;
  players: LobbyPlayer[];
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  settings?: LobbySettings;
}

export interface AniGravityGameState {
  gameId: string;
  gameType: 'ANIGRAVITY';
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  players: Player[];
  turnNumber: number;
  currentPlayerId: string;
  nextPlayerId: string;
  turnOrder: string[];
  activePlayers: string[];
  eliminatedPlayers: string[];
  currentCharacterId: string;
  droppedCharacters: Array<{
    id: string;
    characterId: string;
    playerId: string;
    dropX: number;
    dropAngle: number;
    turnNumber: number;
    x: number;
    y: number;
    angle: number;
    eliminated: boolean;
  }>;
  phase: string;
  turnTimeRemaining: number;
  winnerId: string | null;
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

interface AniGravityStore {
  lobby: LobbyState | null;
  gameState: AniGravityGameState | null;
  error: string | null;
  availableLobbies: PublicLobby[];
  turnTimeRemaining: number;
  eliminationData: { playerId: string, reason: string } | null;

  // Actions
  createLobby: (userId: string, nickname: string) => void;
  joinLobby: (gameId: string, userId: string, nickname: string) => void;
  toggleReady: (gameId: string, userId: string, isReady: boolean) => void;
  kickPlayer: (gameId: string, hostId: string, targetUserId: string) => void;
  leaveLobby: (gameId: string, userId: string) => void;
  invitePlayer: (gameId: string, senderId: string, senderName: string, targetUserId: string) => void;
  updateSettings: (gameId: string, hostId: string, settings: Partial<LobbySettings>) => void;
  startGame: (gameId: string, hostId: string) => void;
  
  // Gameplay Actions
  sendMove: (gameId: string, userId: string, x: number) => void;
  sendRotate: (gameId: string, userId: string, angle: number) => void;
  sendDrop: (gameId: string, userId: string, x: number, angle: number) => void;

  clearState: () => void;
  setError: (msg: string | null) => void;
  fetchLobbies: () => void;

  // Listeners Setup
  setupListeners: (gameId: string, targetUserId: string) => () => void;
}

export const useAniGravityStore = create<AniGravityStore>((set, get) => ({
  lobby: null,
  gameState: null,
  error: null,
  availableLobbies: [],
  turnTimeRemaining: 30,
  eliminationData: null,

  createLobby: (userId, nickname) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_create', { gameType: 'ANIGRAVITY', userId, nickname });
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
    set({ lobby: null, gameState: null, error: null, eliminationData: null });
  },

  invitePlayer: (gameId, senderId, senderName, targetUserId) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_invite', { gameId, senderId, senderName, targetUserId, gameType: 'ANIGRAVITY' });
  },

  updateSettings: (gameId, hostId, settings) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_settings_update', { gameId, hostId, settings });
  },

  startGame: (gameId, hostId) => {
    const socket = socketService.getSocket();
    socket.emit('game_start', { gameId, hostId });
  },

  sendMove: (gameId, userId, x) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'move', data: { x } });
  },

  sendRotate: (gameId, userId, angle) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'rotate', data: { angle } });
  },

  sendDrop: (gameId, userId, x, angle) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'drop', data: { x, angle } });
  },

  clearState: () => set({ lobby: null, gameState: null, error: null, eliminationData: null }),
  setError: (msg) => set({ error: msg }),

  fetchLobbies: () => {
    const socket = socketService.getSocket();
    socket.emit('lobbies_list');
  },

  setupListeners: (gameId, targetUserId) => {
    const socket = socketService.getSocket();

    const onLobbyState = (state: LobbyState) => {
      if (state.gameType && state.gameType !== 'ANIGRAVITY') return;
      set({ lobby: state });
    };

    const onGameState = (state: AniGravityGameState) => {
      if (state.gameType && state.gameType !== 'ANIGRAVITY') return;
      set({ gameState: state });
    };

    const onGameStart = (state: AniGravityGameState) => {
      set({ gameState: state, eliminationData: null });
    };

    const onNextTurn = (data: { currentPlayerId: string, currentCharacter: any }) => {
      set((state) => {
        if (!state.gameState) return state;
        return {
          gameState: {
            ...state.gameState,
            currentPlayerId: data.currentPlayerId,
            currentCharacterId: data.currentCharacter.id,
            phase: 'DROP'
          }
        };
      });
    };

    const onTurnTick = (data: { secondsRemaining: number }) => {
      set({ turnTimeRemaining: data.secondsRemaining });
    };

    const onPlayerEliminated = (data: { playerId: string, reason: string }) => {
      set({ eliminationData: data });
      setTimeout(() => set({ eliminationData: null }), 4000);
    };

    const onGameError = (err: { message: string }) => {
      set({ error: err.message });
      setTimeout(() => set({ error: null }), 3000);
    };

    const onKicked = () => {
      set({ lobby: null, gameState: null, error: 'You were kicked by the host.', eliminationData: null });
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
          gameId: currentGameState.gameType,
          userId: targetUserId
        });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('lobby_state', onLobbyState);
    socket.on('game_state', onGameState);
    socket.on('STATE_SYNC', onGameState);
    socket.on('GAME_START', onGameStart);
    socket.on('NEXT_TURN', onNextTurn);
    socket.on('TURN_TICK', onTurnTick);
    socket.on('PLAYER_ELIMINATED', onPlayerEliminated);
    socket.on('game_error', onGameError);
    socket.on(`lobby_kicked_${gameId}_${targetUserId}`, onKicked);
    socket.on('lobbies_list_response', onLobbiesList);
    socket.on('lobbies_updated', onLobbiesUpdated);

    // We do not intercept PLAYER_MOVE, PLAYER_ROTATE, or DROP_START here 
    // because GameEngine will listen to the socket directly for 60fps responsiveness!

    return () => {
      socket.off('connect', handleConnect);
      socket.off('lobby_state', onLobbyState);
      socket.off('game_state', onGameState);
      socket.off('STATE_SYNC', onGameState);
      socket.off('GAME_START', onGameStart);
      socket.off('NEXT_TURN', onNextTurn);
      socket.off('TURN_TICK', onTurnTick);
      socket.off('PLAYER_ELIMINATED', onPlayerEliminated);
      socket.off('game_error', onGameError);
      socket.off(`lobby_kicked_${gameId}_${targetUserId}`, onKicked);
      socket.off('lobbies_list_response', onLobbiesList);
      socket.off('lobbies_updated', onLobbiesUpdated);
    };
  }
}));
